import { useState, useEffect, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../components/Settings';

const API_BASE = '/api';

// Migration: estimate duration from old questionCount/lexisCount settings
function migrateToTargetDuration(data: Record<string, unknown>): number {
  // If targetDuration is already set, use it
  if (typeof data.targetDuration === 'number') {
    return data.targetDuration;
  }

  // Migrate from old questionCount/lexisCount
  const questionCount = typeof data.questionCount === 'number' ? data.questionCount : 5;
  const lexisCount = typeof data.lexisCount === 'number' ? data.lexisCount : 8;

  // Estimate duration based on content amounts:
  // 3-4 questions + 3-5 vocab = ~5 min
  // 5-6 questions + 6-8 vocab = ~10 min
  // 7-8 questions + 8-10 vocab = ~15 min
  // 8-10 questions + 10-12 vocab = ~20 min
  // 10+ questions + 12+ vocab = ~30 min
  const avgContent = (questionCount + lexisCount) / 2;

  if (avgContent <= 4) return 5;
  if (avgContent <= 7) return 10;
  if (avgContent <= 9) return 15;
  if (avgContent <= 11) return 20;
  return 30;
}

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/settings`);
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings({
        difficultyLevel: data.difficultyLevel || DEFAULT_SETTINGS.difficultyLevel,
        contentMode: data.contentMode || DEFAULT_SETTINGS.contentMode,
        classroomTheme: data.classroomTheme || DEFAULT_SETTINGS.classroomTheme,
        targetDuration: migrateToTargetDuration(data),
        contentModel: data.contentModel || DEFAULT_SETTINGS.contentModel,
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      // Fall back to defaults on error
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to database
  const saveSettings = useCallback(async (newSettings: AppSettings): Promise<boolean> => {
    try {
      setError(null);

      const response = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const data = await response.json();
      setSettings({
        difficultyLevel: data.difficultyLevel,
        contentMode: data.contentMode,
        classroomTheme: data.classroomTheme || 'light',
        targetDuration: data.targetDuration ?? DEFAULT_SETTINGS.targetDuration,
        contentModel: data.contentModel || DEFAULT_SETTINGS.contentModel,
      });
      return true;
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      return false;
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    error,
    loadSettings,
    saveSettings,
  };
};
