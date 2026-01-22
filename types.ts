export enum EngineType {
  BROWSER = 'BROWSER',
  GEMINI = 'GEMINI',
  ELEVEN_LABS = 'ELEVEN_LABS'
}

export interface TTSState {
  text: string;
  isPlaying: boolean;
  isPaused: boolean;
  engine: EngineType;
}

export interface BrowserVoiceConfig {
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  volume: number;
}

export interface GeminiVoiceConfig {
  voiceName: string;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string;
}

export interface SpeakerSegment {
  speaker: string;
  text: string;
}

export interface DialogueAnalysis {
  isDialogue: boolean;
  speakers: string[];
  segments: SpeakerSegment[];
}

export interface SpeakerVoiceMapping {
  [speakerName: string]: string; // Maps speaker name to Voice Name or ID
}

export const GEMINI_VOICES = [
  { name: 'Kore', gender: 'Female', style: 'Calm' },
  { name: 'Puck', gender: 'Male', style: 'Energetic' },
  { name: 'Charon', gender: 'Male', style: 'Deep' },
  { name: 'Fenrir', gender: 'Male', style: 'Intense' },
  { name: 'Zephyr', gender: 'Female', style: 'Soft' }
];

// Saved Audio types for CRUD operations
export interface SavedAudio {
  id: string;
  title: string;
  transcript: string;
  audioUrl?: string | null;
  engine: EngineType;
  speakerMapping: SpeakerVoiceMapping;
  speakers: string[];
  createdAt: string;
  updatedAt: string;
}

// Database row type (snake_case from Supabase)
export interface AudioEntryRow {
  id: string;
  title: string;
  transcript: string;
  audio_url: string | null;
  engine: string;
  speaker_mapping: SpeakerVoiceMapping;
  speakers: string[];
  created_at: string;
  updated_at: string;
}

export type AppView = 'editor' | 'library' | 'detail' | 'test-builder' | 'test-take' | 'classroom' | 'student-test';

// Test/Exercise Types
export type TestType = 'listening-comprehension' | 'fill-in-blank' | 'dictation';

export interface TestQuestion {
  id: string;
  questionText: string;
  options?: string[];        // For multiple choice
  correctAnswer: string;
  explanation?: string;      // Optional explanation shown when answer is wrong
  blankIndex?: number;       // For fill-in-blank (which word is blanked)
}

export interface ListeningTest {
  id: string;
  audioId: string;
  title: string;
  type: TestType;
  questions: TestQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface TestAttempt {
  testId: string;
  answers: { [questionId: string]: string };
  score?: number;
  completedAt?: string;
}