import type { AppMode } from '../contexts/AppModeContext';
import type { TestType } from '../types';

export function modeLabel(mode: AppMode) {
  return {
    preActivity: mode === 'listening' ? 'Pre-Listening' : 'Pre-Reading',
    mainActivity: mode === 'listening' ? 'Listening Comprehension' : 'Reading Comprehension',
    contentSource: mode === 'listening' ? 'Audio' : 'Reading Passage',
    testType: (mode === 'listening' ? 'listening-comprehension' : 'reading-comprehension') as TestType,
    newContent: mode === 'listening' ? 'New Audio' : 'New Passage',
    contentLabel: mode === 'listening' ? 'Transcript' : 'Passage',
  };
}

/** Check if a test type belongs to a given mode */
export function isTestTypeForMode(testType: string, mode: AppMode): boolean {
  if (mode === 'reading') {
    return testType.startsWith('reading');
  }
  // Listening mode includes the legacy types without prefix
  return testType.startsWith('listening') || testType === 'fill-in-blank' || testType === 'dictation';
}
