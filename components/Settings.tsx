import React from 'react';
import { XIcon } from './Icons';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface AppSettings {
  difficultyLevel: CEFRLevel;
}

export const DEFAULT_SETTINGS: AppSettings = {
  difficultyLevel: 'B1',
};

const CEFR_LEVELS: { value: CEFRLevel; label: string; description: string }[] = [
  { value: 'A1', label: 'A1 - Beginner', description: 'Basic phrases, simple present tense, common vocabulary' },
  { value: 'A2', label: 'A2 - Elementary', description: 'Simple sentences, past tense, everyday topics' },
  { value: 'B1', label: 'B1 - Intermediate', description: 'Connected speech, opinions, familiar topics' },
  { value: 'B2', label: 'B2 - Upper-Intermediate', description: 'Complex ideas, abstract topics, natural speech' },
  { value: 'C1', label: 'C1 - Advanced', description: 'Nuanced language, idiomatic expressions' },
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
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
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

        {/* Content */}
        <div className="px-6 py-5">
          {/* Difficulty Level */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Default Difficulty Level (CEFR)
            </label>
            <p className="text-xs text-slate-500 mb-4">
              This affects prompt generation and test question complexity
            </p>
            <div className="space-y-2">
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
                    name="difficulty"
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

// Helper to load settings from localStorage
export const loadSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem('dialogueforge_settings');
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
};

// Helper to save settings to localStorage
export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem('dialogueforge_settings', JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};
