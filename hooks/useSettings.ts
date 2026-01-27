import { useState, useEffect, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../components/Settings';

const API_BASE = '/api';

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
