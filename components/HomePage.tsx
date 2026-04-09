import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CEFRLevel, ContentMode, ContentModel } from './Settings';
import { EFL_TOPICS, SpeakerCount, getRandomTopic, randomSpeakerCount, resolveSpeakerDefault } from '../utils/eflTopics';
import type { SpeakerCountDefault } from './Settings';
import { useAppMode } from '../contexts/AppModeContext';
import { modeLabel } from '../utils/modeLabels';
import { processImage, getImageFromClipboard, type ProcessedImage } from '../utils/imageProcessing';

export type CreationMethod = 'audio' | 'transcript' | 'import' | 'oneshot' | 'jam';
export type { ContentModel } from './Settings';

const MODEL_CONFIG: Record<ContentModel, {
  name: string;
  cost: string;
  description: string;
}> = {
  'gpt-5-mini': {
    name: 'GPT-5 Mini',
    cost: '<$0.001',
    description: 'Fast and economical'
  },
  'gpt-5.2': {
    name: 'GPT-5.2',
    cost: '<$0.01',
    description: 'Higher quality output'
  },
  'claude-sonnet': {
    name: 'Claude Sonnet',
    cost: '~$0.01',
    description: 'Best quality, single call'
  },
};

// Jam settings interface
interface JamSettings {
  targetDuration: number; // 5-30 minutes
  contentMode: ContentMode;
  contentModel: ContentModel;
  useReasoning: boolean;
  speakerCount?: SpeakerCount;
}

interface HomePageProps {
  onSelect: (method: CreationMethod) => void;
  onJamGenerate?: (difficulty: CEFRLevel, settings?: JamSettings & { topic?: string }) => void;
  defaultDifficulty?: CEFRLevel;
  defaultContentMode?: ContentMode;
  defaultTargetDuration?: number;
  defaultContentModel?: ContentModel;
  defaultSpeakerCount?: SpeakerCountDefault;
}

// Icons for the cards
const MicrophoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </svg>
);

const ImportIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const HomePage: React.FC<HomePageProps> = ({
  onSelect,
  onJamGenerate,
  defaultDifficulty = 'B1',
  defaultContentMode = 'standard',
  defaultTargetDuration = 10,
  defaultContentModel = 'gpt-5-mini',
  defaultSpeakerCount = 'random' as const,
}) => {
  const appMode = useAppMode();
  const labels = modeLabel(appMode);
  const [jamExpanded, setJamExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<CEFRLevel>(defaultDifficulty);
  const [jamSettings, setJamSettings] = useState<JamSettings>({
    targetDuration: defaultTargetDuration,
    contentMode: defaultContentMode,
    contentModel: defaultContentModel,
    useReasoning: true,
  });
  const initialSpeakers = useMemo(() => resolveSpeakerDefault(defaultSpeakerCount), []);
  const [speakerCount, setSpeakerCount] = useState<SpeakerCount>(initialSpeakers);
  const [currentTopic, setCurrentTopic] = useState(() =>
    getRandomTopic(initialSpeakers)
  );
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');

  // Textbook extraction state
  const [showTextbookUpload, setShowTextbookUpload] = useState(false);
  const [textbookImages, setTextbookImages] = useState<ProcessedImage[]>([]);
  const [extractionResult, setExtractionResult] = useState<{
    status: 'success' | 'partial' | 'failure';
    statusMessage: string;
    topic: string | null;
    unit: string | null;
    difficulty: string | null;
    vocabulary: { term: string; definition: string | null }[];
    passage: string | null;
    warnings: string[];
  } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState('');
  const [showExtractionJson, setShowExtractionJson] = useState(false);
  const textbookFileRef = useRef<HTMLInputElement>(null);

  const shuffleTopic = () => {
    setCurrentTopic(getRandomTopic(speakerCount, currentTopic));
    setIsCustomTopic(false);
  };

  const handleTextbookFiles = async (files: File[]) => {
    const remaining = 3 - textbookImages.length;
    if (remaining <= 0) return;
    const toProcess = files.slice(0, remaining);
    for (const file of toProcess) {
      try {
        const processed = await processImage(file);
        setTextbookImages(prev => [...prev, processed].slice(0, 3));
      } catch (err) {
        setExtractionError(err instanceof Error ? err.message : 'Failed to process image');
      }
    }
  };

  const handleExtract = async () => {
    if (textbookImages.length === 0) return;
    setIsExtracting(true);
    setExtractionError('');
    setExtractionResult(null);
    setShowExtractionJson(false);
    try {
      const res = await fetch('/api/extract-textbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: textbookImages.map(img => img.dataUri),
          mode: appMode,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Extraction failed (${res.status})`);
      }
      const result = await res.json();
      setExtractionResult(result);
      if (result.topic) {
        setCurrentTopic(result.topic);
        setIsCustomTopic(false);
      }
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  const removeImage = (index: number) => {
    setTextbookImages(prev => prev.filter((_, i) => i !== index));
    setExtractionResult(null);
    setExtractionError('');
  };

  const clearTextbook = () => {
    setTextbookImages([]);
    setExtractionResult(null);
    setExtractionError('');
    setShowExtractionJson(false);
    setShowTextbookUpload(false);
    if (textbookFileRef.current) textbookFileRef.current.value = '';
  };

  // Clipboard paste listener for textbook images
  useEffect(() => {
    if (!showTextbookUpload) return;
    const handler = (e: ClipboardEvent) => {
      const file = getImageFromClipboard(e);
      if (file) {
        e.preventDefault();
        handleTextbookFiles([file]);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [showTextbookUpload, textbookImages.length]);

  const handleSpeakerCountChange = (count: SpeakerCount) => {
    setSpeakerCount(count);
    setCurrentTopic(getRandomTopic(count));
    setIsCustomTopic(false);
  };

  // Sync state with global settings when they load/change
  useEffect(() => {
    setSelectedDifficulty(defaultDifficulty);
    setJamSettings(s => ({
      ...s,
      targetDuration: defaultTargetDuration,
      contentMode: defaultContentMode,
      contentModel: defaultContentModel,
    }));
  }, [defaultDifficulty, defaultTargetDuration, defaultContentMode, defaultContentModel]);

  const methods = [
    // Generate Audio — listening mode only
    ...(appMode === 'listening' ? [{
      id: 'audio' as CreationMethod,
      title: 'Generate Audio',
      description: 'Create from text with AI voices',
      icon: MicrophoneIcon,
      gradient: 'from-indigo-500 to-violet-500',
      hoverGradient: 'hover:from-indigo-400 hover:to-violet-400',
      shadow: 'shadow-indigo-500/30',
    }] : []),
    {
      id: 'transcript' as CreationMethod,
      title: appMode === 'reading' ? 'Paste Passage' : 'Text Only',
      description: appMode === 'reading' ? 'Add a reading passage' : 'Add transcript without audio',
      icon: FileTextIcon,
      gradient: 'from-emerald-500 to-teal-500',
      hoverGradient: 'hover:from-emerald-400 hover:to-teal-400',
      shadow: 'shadow-emerald-500/30',
    },
    // Import — listening mode only
    ...(appMode === 'listening' ? [{
      id: 'import' as CreationMethod,
      title: 'Import Content',
      description: 'Import existing questions & vocab',
      icon: ImportIcon,
      gradient: 'from-amber-500 to-orange-500',
      hoverGradient: 'hover:from-amber-400 hover:to-orange-400',
      shadow: 'shadow-amber-500/30',
    }] : []),
    {
      id: 'oneshot' as CreationMethod,
      title: 'One Shot',
      description: 'Complete test in one step',
      icon: ZapIcon,
      gradient: 'from-rose-500 to-pink-500',
      hoverGradient: 'hover:from-rose-400 hover:to-pink-400',
      shadow: 'shadow-rose-500/30',
    },
  ];

  const handleJamClick = () => {
    if (jamExpanded) {
      // Already expanded, trigger generation
      if (onJamGenerate) {
        onJamGenerate(selectedDifficulty);
      } else {
        onSelect('jam');
      }
    } else {
      // Expand to show confirmation
      setJamExpanded(true);
    }
  };

  const handleGenerateClick = () => {
    if (onJamGenerate) {
      onJamGenerate(selectedDifficulty, { ...jamSettings, speakerCount, topic: isCustomTopic ? customTopic : currentTopic });
    } else {
      onSelect('jam');
    }
  };

  return (
    <main className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-900 bg-clip-text text-transparent mb-4">
            Create {appMode === 'reading' ? 'Reading' : 'Listening'} Content
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Choose how you'd like to create your EFL {appMode === 'reading' ? 'reading' : 'listening'} materials
          </p>
        </div>

        {/* Method Cards - 4 column grid */}
        <div className={`grid grid-cols-2 ${methods.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-10`}>
          {methods.map((method) => (
            <button
              key={method.id}
              onClick={() => onSelect(method.id)}
              className={`group relative p-6 rounded-2xl bg-gradient-to-br ${method.gradient} ${method.hoverGradient} text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-xl ${method.shadow} active:scale-[0.98]`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <method.icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg mb-1">{method.title}</h3>
                <p className="text-xs text-white/80 leading-relaxed">{method.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          <span className="text-sm text-slate-400 font-medium">or quick generate</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        </div>

        {/* JAM Section */}
        <div className="flex flex-col items-center">
          {/* Initial State - Just the JAM button */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleJamClick}
              className="relative w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-red-700
                         text-white font-bold text-3xl shadow-lg shadow-red-500/40
                         hover:from-red-400 hover:to-red-600 hover:scale-110 hover:shadow-xl hover:shadow-red-500/50
                         active:scale-95 transition-all duration-300
                         border-4 border-red-800/50"
            >
              JAM
            </button>
            <p className="text-sm text-slate-500">One click, complete test</p>
          </div>
        </div>

        {/* Expanded State - Floating Modal */}
        {jamExpanded && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative max-h-[90vh] flex flex-col">
              {/* Header with close button - always visible */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Quick Generate</h3>
                  <p className="text-xs text-slate-500">Create a complete {appMode === 'reading' ? 'reading' : 'listening'} test</p>
                </div>
                <button
                  onClick={() => setJamExpanded(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col items-center gap-5">
                {/* Difficulty Selector */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-slate-600 mb-2 text-center">
                    Select difficulty level
                  </label>
                  <div className="flex justify-center gap-2">
                    {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(level => (
                      <button
                        key={level}
                        onClick={() => setSelectedDifficulty(level)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                          selectedDifficulty === level
                            ? 'bg-red-500 text-white shadow-md scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speaker Count — listening mode only */}
                {appMode === 'listening' && (
                <div className="w-full">
                  <label className="block text-sm font-medium text-slate-600 mb-2 text-center">Speakers</label>
                  <div className="flex justify-center gap-2">
                    {([1, 2, 3] as SpeakerCount[]).map((count) => (
                      <button
                        key={count}
                        onClick={() => handleSpeakerCountChange(count)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          speakerCount === count
                            ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {count === 3 ? '3+' : count}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const count = randomSpeakerCount(speakerCount);
                        setSpeakerCount(count);
                        setCurrentTopic(getRandomTopic(count));
                        setIsCustomTopic(false);
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-all"
                      title="Random speaker count"
                    >
                      🎲
                    </button>
                  </div>
                </div>
                )}

                {/* Topic */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-slate-600 mb-2 text-center">Topic</label>
                  <div className="flex items-center gap-2">
                    {isCustomTopic ? (
                      <input
                        type="text"
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder="Type a custom topic..."
                        className="flex-1 px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700 truncate">
                        {currentTopic}
                      </div>
                    )}
                    <button
                      onClick={shuffleTopic}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                    >
                      🎲
                    </button>
                    <button
                      onClick={() => setIsCustomTopic(!isCustomTopic)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        isCustomTopic ? 'bg-red-100 text-red-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setShowTextbookUpload(!showTextbookUpload)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        showTextbookUpload || textbookImages.length > 0
                          ? 'bg-indigo-100 text-indigo-600'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title="Extract from textbook"
                    >
                      📖
                    </button>
                  </div>

                  {/* Textbook extraction expandable */}
                  {showTextbookUpload && (
                    <div className="mt-2 border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                      {/* Drop zone — shown when < 3 images and no extraction result */}
                      {textbookImages.length < 3 && !extractionResult && (
                        <div
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50'); }}
                          onDragLeave={(e) => { e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50'); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50');
                            const files = Array.from(e.dataTransfer.files);
                            if (files.length) handleTextbookFiles(files);
                          }}
                          className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center transition-colors"
                        >
                          <p className="text-sm font-medium text-slate-700 mb-1">
                            {appMode === 'reading'
                              ? 'Upload textbook pages to extract topic, vocabulary, and passage'
                              : 'Upload textbook pages to extract topic and vocabulary'}
                          </p>
                          <p className="text-xs text-slate-400 mb-3">Drag files here, paste a screenshot (Ctrl+V), or browse — up to 3 pages</p>
                          <button
                            onClick={() => textbookFileRef.current?.click()}
                            className="px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 transition-colors"
                          >
                            Browse Files
                          </button>
                        </div>
                      )}

                      {/* Thumbnail grid */}
                      {textbookImages.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] text-slate-500 font-medium">{textbookImages.length} of 3 images</span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {textbookImages.map((img, i) => (
                              <div key={i} className="relative group">
                                <img src={img.dataUri} alt={img.fileName} className="w-16 h-20 object-cover rounded-lg border border-slate-200" />
                                {!extractionResult && (
                                  <button
                                    onClick={() => removeImage(i)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extract Content button */}
                      {textbookImages.length > 0 && !extractionResult && !isExtracting && (
                        <button
                          onClick={handleExtract}
                          className="w-full py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 transition-colors"
                        >
                          Extract Content
                        </button>
                      )}

                      {/* Extracting spinner */}
                      {isExtracting && (
                        <div className="flex items-center justify-center gap-2 py-3">
                          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-indigo-600">Analyzing {textbookImages.length} page{textbookImages.length > 1 ? 's' : ''}...</span>
                        </div>
                      )}

                      {/* Error */}
                      {extractionError && (
                        <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{extractionError}</div>
                      )}

                      {/* Extraction results */}
                      {extractionResult && (
                        <>
                          <div className={`px-2 py-1.5 rounded-lg text-xs border ${
                            extractionResult.status === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : extractionResult.status === 'partial'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-red-50 border-red-200 text-red-700'
                          }`}>
                            <p className="font-medium">
                              {extractionResult.status === 'success' ? 'Extraction successful' :
                               extractionResult.status === 'partial' ? 'Partial extraction' :
                               'Extraction failed'}
                            </p>
                            <p className="mt-0.5">{extractionResult.statusMessage}</p>
                          </div>

                          {extractionResult.status !== 'failure' && (
                            <div className="flex flex-wrap gap-1.5">
                              {extractionResult.topic && (
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-medium rounded-full">
                                  Topic: {extractionResult.topic}
                                </span>
                              )}
                              {extractionResult.vocabulary.length > 0 && (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-full">
                                  {extractionResult.vocabulary.length} vocab
                                </span>
                              )}
                              {extractionResult.passage && (
                                <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-medium rounded-full">
                                  Passage found
                                </span>
                              )}
                              {extractionResult.difficulty && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full">
                                  {extractionResult.difficulty}
                                </span>
                              )}
                            </div>
                          )}

                          <button
                            onClick={() => setShowExtractionJson(!showExtractionJson)}
                            className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium"
                          >
                            {showExtractionJson ? 'Hide JSON ▲' : 'Show JSON ▼'}
                          </button>
                          {showExtractionJson && (
                            <pre className="text-[10px] bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-auto max-h-48 text-slate-700">
                              {JSON.stringify(extractionResult, null, 2)}
                            </pre>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            {textbookImages.length < 3 && (
                              <button
                                onClick={() => { setExtractionResult(null); setExtractionError(''); }}
                                className="flex-1 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-100 transition-colors"
                              >
                                + Add Pages
                              </button>
                            )}
                            <button
                              onClick={clearTextbook}
                              className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              Clear All
                            </button>
                          </div>
                        </>
                      )}

                      <input
                        ref={textbookFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length) handleTextbookFiles(files);
                          if (textbookFileRef.current) textbookFileRef.current.value = '';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Settings Toggle */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" />
                  <span>Advanced Settings</span>
                  <ChevronDownIcon className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                </button>

                {/* Expandable Settings Panel */}
                {showSettings && (
                  <div className="w-full bg-slate-50 rounded-xl p-4 space-y-4">
                    {/* Content Mode */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Content Mode</label>
                      <select
                        value={jamSettings.contentMode}
                        onChange={(e) => setJamSettings(s => ({ ...s, contentMode: e.target.value as ContentMode }))}
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="standard">Standard</option>
                        <option value="halal">Halal</option>
                        <option value="elsd">ELSD (University)</option>
                      </select>
                    </div>

                    {/* AI Model */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">AI Model</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['gpt-5-mini', 'gpt-5.2'] as ContentModel[]).map((model) => {
                          const config = MODEL_CONFIG[model];
                          return (
                            <button
                              key={model}
                              onClick={() => setJamSettings(s => ({ ...s, contentModel: model }))}
                              className={`p-2 rounded-lg text-left border-2 transition-all ${
                                jamSettings.contentModel === model
                                  ? 'border-red-500 bg-red-50'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-slate-800 text-xs">{config.name}</span>
                                <span className="text-xs font-bold text-red-600">{config.cost}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setJamSettings(s => ({ ...s, contentModel: 'claude-sonnet' }))}
                        className={`w-full mt-2 p-2 rounded-lg text-left border-2 transition-all ${
                          jamSettings.contentModel === 'claude-sonnet'
                            ? 'border-violet-500 bg-violet-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-800 text-xs">Claude Sonnet 4.6</span>
                          <span className={`text-xs font-bold ${jamSettings.contentModel === 'claude-sonnet' ? 'text-violet-600' : 'text-red-600'}`}>~$0.01</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">Best quality, single call</p>
                      </button>
                    </div>

                    {/* Test Duration */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Test Duration: {jamSettings.targetDuration} min
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="30"
                        step="5"
                        value={jamSettings.targetDuration}
                        onChange={(e) => setJamSettings(s => ({ ...s, targetDuration: parseInt(e.target.value) }))}
                        className="w-full accent-red-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>5 min</span>
                        <span>15 min</span>
                        <span>30 min</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        AI determines question and vocabulary counts based on duration and level
                      </p>
                    </div>

                    {/* AI Reasoning */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jamSettings.useReasoning}
                          onChange={(e) => setJamSettings(s => ({ ...s, useReasoning: e.target.checked }))}
                          className="w-4 h-4 accent-red-500"
                        />
                        <span className="text-xs text-slate-700">Enable AI reasoning</span>
                      </label>
                      <p className="text-[10px] text-slate-500 mt-1 ml-6">
                        {jamSettings.useReasoning ? 'Higher quality, slower generation' : 'Faster generation, may reduce quality'}
                      </p>
                    </div>
                  </div>
                )}

                {/* What will be generated - hide when settings expanded to save space */}
                {!showSettings && (
                  <div className="text-center text-sm text-slate-500 bg-slate-50 rounded-xl p-4 w-full">
                    <p className="font-medium text-slate-700 mb-2">This will generate a {jamSettings.targetDuration}-minute test:</p>
                    <ul className="space-y-1">
                      <li>• {appMode === 'reading' ? 'Reading passage' : 'Audio dialogue with AI voices'}</li>
                      <li>• Comprehension questions</li>
                      <li>• Vocabulary items with games</li>
                      <li>• Preview activities</li>
                    </ul>
                    <p className="text-xs text-slate-400 mt-2">
                      Content amount adjusted for {selectedDifficulty} level
                    </p>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={handleGenerateClick}
                  className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold text-lg
                             hover:from-red-400 hover:to-red-500 hover:shadow-lg hover:shadow-red-500/30
                             active:scale-[0.98] transition-all duration-200"
                >
                  Generate {selectedDifficulty} Test
                </button>

                {/* Cost indicator */}
                <span className="text-xs text-slate-400">{MODEL_CONFIG[jamSettings.contentModel].cost} per test</span>
              </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
};
