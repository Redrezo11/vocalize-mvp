import React from 'react';
import { XIcon } from './Icons';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type ContentMode = 'standard' | 'halal' | 'elsd';
export type ClassroomTheme = 'light' | 'dark';
export type ContentModel = 'gpt-5-mini' | 'gpt-5.2';

export interface AppSettings {
  difficultyLevel: CEFRLevel;
  contentMode: ContentMode;
  classroomTheme: ClassroomTheme;
  // JAM generation defaults
  targetDuration: number; // 5-30 minutes
  contentModel: ContentModel;
}

export const DEFAULT_SETTINGS: AppSettings = {
  difficultyLevel: 'B1',
  contentMode: 'standard',
  classroomTheme: 'light',
  // JAM generation defaults
  targetDuration: 10, // 10 minutes default
  contentModel: 'gpt-5-mini',
};

const CEFR_LEVELS: { value: CEFRLevel; label: string; shortLabel: string; description: string }[] = [
  { value: 'A1', label: 'A1 - Beginner', shortLabel: 'A1', description: 'Basic phrases, simple present tense, common vocabulary' },
  { value: 'A2', label: 'A2 - Elementary', shortLabel: 'A2', description: 'Simple sentences, past tense, everyday topics' },
  { value: 'B1', label: 'B1 - Intermediate', shortLabel: 'B1', description: 'Connected speech, opinions, familiar topics' },
  { value: 'B2', label: 'B2 - Upper-Intermediate', shortLabel: 'B2', description: 'Complex ideas, abstract topics, natural speech' },
  { value: 'C1', label: 'C1 - Advanced', shortLabel: 'C1', description: 'Nuanced language, idiomatic expressions' },
];

const CONTENT_MODES: { value: ContentMode; label: string; description: string; color: string }[] = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'No content restrictions - suitable for general audiences',
    color: 'slate'
  },
  {
    value: 'halal',
    label: 'Halal (Casual)',
    description: 'Avoids major haram: alcohol, pork, gambling, dating. Suitable for Muslims in diverse contexts.',
    color: 'green'
  },
  {
    value: 'elsd',
    label: 'ELSD (KSU)',
    description: 'Follows KSU university guidelines. No music, celebrities, non-Islamic holidays, mixed-gender socializing, etc.',
    color: 'amber'
  },
];

interface SettingsProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = React.useState<AppSettings>(settings);

  React.useEffect(() => {
    // Handle migration from old boolean halalMode to new contentMode
    const migrated = { ...settings };
    if ('halalMode' in settings && !('contentMode' in settings)) {
      // @ts-ignore - handling legacy data
      migrated.contentMode = settings.halalMode ? 'halal' : 'standard';
    }
    setLocalSettings(migrated);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const getColorClasses = (mode: ContentMode, isSelected: boolean) => {
    if (!isSelected) return 'border-slate-200 hover:border-slate-300 hover:bg-slate-50';

    switch (mode) {
      case 'standard':
        return 'border-slate-500 bg-slate-50';
      case 'halal':
        return 'border-green-500 bg-green-50';
      case 'elsd':
        return 'border-amber-500 bg-amber-50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Responsive width */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {/* Desktop: Two-column layout, Mobile: Single column */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-8">
            {/* Left Column: Difficulty Level */}
            <div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Default Difficulty Level (CEFR)
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  Affects prompt generation and test question complexity
                </p>

                {/* Mobile: Vertical list */}
                <div className="lg:hidden space-y-2">
                  {CEFR_LEVELS.map((level) => (
                    <label
                      key={level.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        localSettings.difficultyLevel === level.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="difficulty-mobile"
                        value={level.value}
                        checked={localSettings.difficultyLevel === level.value}
                        onChange={() =>
                          setLocalSettings({ ...localSettings, difficultyLevel: level.value })
                        }
                        className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="block font-medium text-slate-900">
                          {level.label}
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {level.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Desktop: Compact horizontal cards */}
                <div className="hidden lg:grid lg:grid-cols-5 lg:gap-2">
                  {CEFR_LEVELS.map((level) => (
                    <div
                      key={level.value}
                      onClick={() => setLocalSettings({ ...localSettings, difficultyLevel: level.value })}
                      className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                        localSettings.difficultyLevel === level.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`block text-lg font-bold ${
                        localSettings.difficultyLevel === level.value
                          ? 'text-indigo-600'
                          : 'text-slate-700'
                      }`}>
                        {level.shortLabel}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-1 leading-tight">
                        {level.value === 'A1' && 'Beginner'}
                        {level.value === 'A2' && 'Elementary'}
                        {level.value === 'B1' && 'Intermediate'}
                        {level.value === 'B2' && 'Upper-Int.'}
                        {level.value === 'C1' && 'Advanced'}
                      </span>
                      {localSettings.difficultyLevel === level.value && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop: Show selected level description */}
                <div className="hidden lg:block mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-indigo-600">
                      {CEFR_LEVELS.find(l => l.value === localSettings.difficultyLevel)?.label}:
                    </span>{' '}
                    {CEFR_LEVELS.find(l => l.value === localSettings.difficultyLevel)?.description}
                  </p>
                </div>
              </div>

              {/* Divider - Mobile only */}
              <div className="border-t border-slate-200 my-5 lg:hidden"></div>

              {/* Classroom Theme - Shown in left column on desktop */}
              <div className="hidden lg:block lg:mt-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Classroom Theme
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  Appearance for classroom presentations and student quizzes
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setLocalSettings({ ...localSettings, classroomTheme: 'light' })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      localSettings.classroomTheme === 'light'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-16 h-10 rounded-lg bg-white border border-slate-300 shadow-sm flex items-center justify-center">
                      <div className="w-8 h-5 rounded bg-slate-100 border border-slate-200"></div>
                    </div>
                    <span className="text-sm font-medium text-slate-900">Light</span>
                    <span className="text-xs text-slate-500">Bright background</span>
                  </div>
                  <div
                    onClick={() => setLocalSettings({ ...localSettings, classroomTheme: 'dark' })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      localSettings.classroomTheme === 'dark'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-16 h-10 rounded-lg bg-slate-800 border border-slate-700 shadow-sm flex items-center justify-center">
                      <div className="w-8 h-5 rounded bg-slate-700 border border-slate-600"></div>
                    </div>
                    <span className="text-sm font-medium text-slate-900">Dark</span>
                    <span className="text-xs text-slate-500">Easy on the eyes</span>
                  </div>
                </div>
              </div>

              {/* JAM Generation Defaults - Desktop only */}
              <div className="hidden lg:block lg:mt-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  JAM Generation Defaults
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  Default settings for quick test generation
                </p>
                <div className="space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  {/* AI Model */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">AI Model</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setLocalSettings({ ...localSettings, contentModel: 'gpt-5-mini' })}
                        className={`p-2 rounded-lg text-left border-2 transition-all ${
                          localSettings.contentModel === 'gpt-5-mini'
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-800 text-xs">GPT-5 Mini</span>
                          <span className="text-xs font-bold text-indigo-600">&lt;$0.001</span>
                        </div>
                      </button>
                      <button
                        onClick={() => setLocalSettings({ ...localSettings, contentModel: 'gpt-5.2' })}
                        className={`p-2 rounded-lg text-left border-2 transition-all ${
                          localSettings.contentModel === 'gpt-5.2'
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-800 text-xs">GPT-5.2</span>
                          <span className="text-xs font-bold text-indigo-600">&lt;$0.01</span>
                        </div>
                      </button>
                    </div>
                  </div>
                  {/* Test Duration */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Test Duration: {localSettings.targetDuration} min
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={localSettings.targetDuration}
                      onChange={(e) => setLocalSettings({ ...localSettings, targetDuration: parseInt(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>5 min</span>
                      <span>15 min</span>
                      <span>30 min</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                      AI determines question and vocabulary counts based on duration and CEFR level
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Content Guidelines */}
            <div className="lg:border-l lg:border-slate-200 lg:pl-8">
              {/* Content Mode */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Content Guidelines
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  Controls cultural and religious content restrictions for generated materials
                </p>
                <div className="space-y-2">
                  {CONTENT_MODES.map((mode) => (
                    <label
                      key={mode.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        getColorClasses(mode.value, localSettings.contentMode === mode.value)
                      }`}
                    >
                      <input
                        type="radio"
                        name="contentMode"
                        value={mode.value}
                        checked={localSettings.contentMode === mode.value}
                        onChange={() =>
                          setLocalSettings({ ...localSettings, contentMode: mode.value })
                        }
                        className={`mt-1 w-4 h-4 border-slate-300 focus:ring-offset-0 ${
                          mode.value === 'standard' ? 'text-slate-600 focus:ring-slate-500' :
                          mode.value === 'halal' ? 'text-green-600 focus:ring-green-500' :
                          'text-amber-600 focus:ring-amber-500'
                        }`}
                      />
                      <div className="flex-1">
                        <span className="block font-medium text-slate-900">
                          {mode.label}
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {mode.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Info box based on selected mode */}
                {localSettings.contentMode === 'halal' && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-xs text-green-800 font-medium mb-1">Casual Halal Mode</p>
                    <p className="text-xs text-green-700">
                      Avoids: alcohol, pork, gambling, dating/romance outside marriage, inappropriate relationships.
                      Allows: general entertainment references, Western cultural contexts, music mentions in passing.
                    </p>
                  </div>
                )}
                {localSettings.contentMode === 'elsd' && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs text-amber-800 font-medium mb-1">ELSD Mode (KSU Guidelines)</p>
                    <p className="text-xs text-amber-700">
                      <strong>Avoids:</strong> All halal restrictions PLUS music/singing, celebrities, non-Islamic holidays,
                      magic/supernatural, mixed-gender casual socializing, moving out at 18, fashion focus, film-making careers.
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      <strong>Uses:</strong> Eid traditions, Saudi National Day, family gatherings, sports, educational activities,
                      professional mixed-gender contexts only.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile-only: Classroom Theme at bottom */}
          <div className="lg:hidden">
            {/* Divider */}
            <div className="border-t border-slate-200 my-5"></div>

            {/* Classroom Theme */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Classroom Theme
              </label>
              <p className="text-xs text-slate-500 mb-4">
                Appearance for classroom presentations and student quizzes
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setLocalSettings({ ...localSettings, classroomTheme: 'light' })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    localSettings.classroomTheme === 'light'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-12 h-8 rounded-lg bg-white border border-slate-300 shadow-sm flex items-center justify-center">
                    <div className="w-6 h-4 rounded bg-slate-100 border border-slate-200"></div>
                  </div>
                  <span className="text-sm font-medium text-slate-900">Light</span>
                  <span className="text-xs text-slate-500">Bright background</span>
                </div>
                <div
                  onClick={() => setLocalSettings({ ...localSettings, classroomTheme: 'dark' })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    localSettings.classroomTheme === 'dark'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-12 h-8 rounded-lg bg-slate-800 border border-slate-700 shadow-sm flex items-center justify-center">
                    <div className="w-6 h-4 rounded bg-slate-700 border border-slate-600"></div>
                  </div>
                  <span className="text-sm font-medium text-slate-900">Dark</span>
                  <span className="text-xs text-slate-500">Easy on the eyes</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-200 my-5"></div>

            {/* JAM Generation Defaults - Mobile */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                JAM Generation Defaults
              </label>
              <p className="text-xs text-slate-500 mb-4">
                Default settings for quick test generation
              </p>
              <div className="space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                {/* AI Model */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">AI Model</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLocalSettings({ ...localSettings, contentModel: 'gpt-5-mini' })}
                      className={`p-2 rounded-lg text-left border-2 transition-all ${
                        localSettings.contentModel === 'gpt-5-mini'
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-800 text-xs">GPT-5 Mini</span>
                        <span className="text-xs font-bold text-indigo-600">&lt;$0.001</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setLocalSettings({ ...localSettings, contentModel: 'gpt-5.2' })}
                      className={`p-2 rounded-lg text-left border-2 transition-all ${
                        localSettings.contentModel === 'gpt-5.2'
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-800 text-xs">GPT-5.2</span>
                        <span className="text-xs font-bold text-indigo-600">&lt;$0.01</span>
                      </div>
                    </button>
                  </div>
                </div>
                {/* Test Duration */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Test Duration: {localSettings.targetDuration} min
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="5"
                    value={localSettings.targetDuration}
                    onChange={(e) => setLocalSettings({ ...localSettings, targetDuration: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>5 min</span>
                    <span>15 min</span>
                    <span>30 min</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    AI determines question and vocabulary counts based on duration and CEFR level
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
