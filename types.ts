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
  labels?: {
    gender?: string;
    age?: string;
    accent?: string;
    description?: string;
    use_case?: string;
  };
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
  // Female voices
  { name: 'Aoede', gender: 'Female', style: 'Breezy' },
  { name: 'Kore', gender: 'Female', style: 'Firm' },
  { name: 'Leda', gender: 'Female', style: 'Youthful' },
  { name: 'Zephyr', gender: 'Female', style: 'Bright' },
  { name: 'Autonoe', gender: 'Female', style: 'Warm' },
  { name: 'Callirhoe', gender: 'Female', style: 'Gentle' },
  { name: 'Despina', gender: 'Female', style: 'Smooth' },
  { name: 'Erinome', gender: 'Female', style: 'Clear' },
  { name: 'Gacrux', gender: 'Female', style: 'Mature' },
  { name: 'Laomedeia', gender: 'Female', style: 'Calm' },
  { name: 'Pulcherrima', gender: 'Female', style: 'Elegant' },
  { name: 'Sulafat', gender: 'Female', style: 'Serene' },
  { name: 'Vindemiatrix', gender: 'Female', style: 'Refined' },
  { name: 'Achernar', gender: 'Female', style: 'Soft' },
  // Male voices
  { name: 'Puck', gender: 'Male', style: 'Upbeat' },
  { name: 'Charon', gender: 'Male', style: 'Informative' },
  { name: 'Fenrir', gender: 'Male', style: 'Excitable' },
  { name: 'Orus', gender: 'Male', style: 'Firm' },
  { name: 'Achird', gender: 'Male', style: 'Friendly' },
  { name: 'Algenib', gender: 'Male', style: 'Gravelly' },
  { name: 'Algieba', gender: 'Male', style: 'Smooth' },
  { name: 'Alnilam', gender: 'Male', style: 'Firm' },
  { name: 'Enceladus', gender: 'Male', style: 'Breathy' },
  { name: 'Iapetus', gender: 'Male', style: 'Deep' },
  { name: 'Rasalgethi', gender: 'Male', style: 'Lively' },
  { name: 'Sadachbia', gender: 'Male', style: 'Clear' },
  { name: 'Sadaltager', gender: 'Male', style: 'Knowledgeable' },
  { name: 'Schedar', gender: 'Male', style: 'Professional' },
  { name: 'Umbriel', gender: 'Male', style: 'Relaxed' },
  { name: 'Zubenelgenubi', gender: 'Male', style: 'Casual' },
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
  isTranscriptOnly?: boolean;  // True for transcript-only entries (no audio)
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
  is_transcript_only?: boolean;
  created_at: string;
  updated_at: string;
}

export type AppView = 'editor' | 'library' | 'detail' | 'test-builder' | 'test-take' | 'classroom' | 'student-test' | 'transcript';

// Test/Exercise Types
export type TestType = 'listening-comprehension' | 'fill-in-blank' | 'dictation';

export interface TestQuestion {
  id: string;
  questionText: string;
  options?: string[];        // For multiple choice
  correctAnswer: string;
  explanation?: string;      // Optional explanation in English
  explanationArabic?: string; // Optional explanation in Arabic
  blankIndex?: number;       // For fill-in-blank (which word is blanked)
}

// Lexis (vocabulary) item for test
export interface LexisItem {
  id: string;
  term: string;                    // The vocabulary word or phrase
  definition: string;              // English definition
  definitionArabic?: string;       // Arabic translation/definition
  example?: string;                // Example sentence from transcript or context
  partOfSpeech?: string;           // noun, verb, adjective, etc.
}

export interface LexisAudio {
  url: string;                     // Audio URL (base64 data URL or cloudinary)
  generatedAt: string;
  engine: 'gemini' | 'elevenlabs';
}

export interface ListeningTest {
  id: string;
  audioId: string;
  title: string;
  type: TestType;
  questions: TestQuestion[];
  lexis?: LexisItem[];             // Optional vocabulary items
  lexisAudio?: LexisAudio;         // Generated vocabulary audio
  createdAt: string;
  updatedAt: string;
}

export interface TestAttempt {
  testId: string;
  answers: { [questionId: string]: string };
  score?: number;
  completedAt?: string;
}