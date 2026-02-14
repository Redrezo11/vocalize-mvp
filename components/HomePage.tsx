import React, { useState, useEffect } from 'react';
import { CEFRLevel, ContentMode, ContentModel } from './Settings';
import { EFL_TOPICS, SpeakerCount, getRandomTopic } from '../utils/eflTopics';

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
}) => {
  const [jamExpanded, setJamExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<CEFRLevel>(defaultDifficulty);
  const [jamSettings, setJamSettings] = useState<JamSettings>({
    targetDuration: defaultTargetDuration,
    contentMode: defaultContentMode,
    contentModel: defaultContentModel,
    useReasoning: true,
  });
  const [speakerCount, setSpeakerCount] = useState<SpeakerCount>(2);
  const [currentTopic, setCurrentTopic] = useState(() =>
    getRandomTopic(2)
  );
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');

  const shuffleTopic = () => {
    setCurrentTopic(getRandomTopic(speakerCount, currentTopic));
    setIsCustomTopic(false);
  };

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
    {
      id: 'audio' as CreationMethod,
      title: 'Generate Audio',
      description: 'Create from text with AI voices',
      icon: MicrophoneIcon,
      gradient: 'from-indigo-500 to-violet-500',
      hoverGradient: 'hover:from-indigo-400 hover:to-violet-400',
      shadow: 'shadow-indigo-500/30',
    },
    {
      id: 'transcript' as CreationMethod,
      title: 'Text Only',
      description: 'Add transcript without audio',
      icon: FileTextIcon,
      gradient: 'from-emerald-500 to-teal-500',
      hoverGradient: 'hover:from-emerald-400 hover:to-teal-400',
      shadow: 'shadow-emerald-500/30',
    },
    {
      id: 'import' as CreationMethod,
      title: 'Import Content',
      description: 'Import existing questions & vocab',
      icon: ImportIcon,
      gradient: 'from-amber-500 to-orange-500',
      hoverGradient: 'hover:from-amber-400 hover:to-orange-400',
      shadow: 'shadow-amber-500/30',
    },
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
            Create Listening Content
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Choose how you'd like to create your EFL listening materials
          </p>
        </div>

        {/* Method Cards - 4 column grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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
                  <p className="text-xs text-slate-500">Create a complete listening test</p>
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

                {/* Speaker Count */}
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
                  </div>
                </div>

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
                  </div>
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
                        {(Object.keys(MODEL_CONFIG) as ContentModel[]).map((model) => {
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
                      <li>• Audio dialogue with AI voices</li>
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
