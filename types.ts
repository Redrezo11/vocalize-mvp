export enum EngineType {
  BROWSER = 'BROWSER',
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
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

export const OPENAI_VOICES = [
  // Female voices
  { name: 'nova', gender: 'Female', style: 'Bright' },
  { name: 'shimmer', gender: 'Female', style: 'Soft' },
  { name: 'coral', gender: 'Female', style: 'Warm' },
  { name: 'sage', gender: 'Female', style: 'Calm' },
  { name: 'ballad', gender: 'Female', style: 'Melodic' },
  // Male voices
  { name: 'echo', gender: 'Male', style: 'Deep' },
  { name: 'fable', gender: 'Male', style: 'Warm' },
  { name: 'onyx', gender: 'Male', style: 'Authoritative' },
  { name: 'ash', gender: 'Male', style: 'Clear' },
  { name: 'verse', gender: 'Male', style: 'Versatile' },
  // Neutral
  { name: 'alloy', gender: 'Neutral', style: 'Balanced' },
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
  difficulty?: string;  // CEFR level used when generating (A1, A2, B1, B2, C1)
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

export type AppView = 'home' | 'editor' | 'library' | 'detail' | 'test-builder' | 'test-take' | 'classroom' | 'student-test' | 'transcript';

// Test/Exercise Types
export type TestType =
  | 'listening-comprehension' | 'fill-in-blank' | 'dictation'
  | 'reading-comprehension' | 'reading-fill-in-blank';

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
  hintArabic?: string;             // Arabic explanation of the English definition (for gap-fill hints)
  explanation?: string;            // English explanation shown on wrong answer in gap-fill
  explanationArabic?: string;      // Arabic explanation shown on wrong answer in gap-fill
  example?: string;                // Example sentence from transcript or context
  partOfSpeech?: string;           // noun, verb, adjective, etc.
}

export interface WordAudio {
  url: string;                     // Audio URL for individual word
  duration?: number;               // Duration in seconds (for timing slideshow)
}

export interface LexisAudio {
  url: string;                     // Full audio URL (base64 data URL or cloudinary)
  generatedAt: string;
  engine: 'gemini' | 'elevenlabs' | 'openai';
  wordAudios?: { [wordId: string]: WordAudio };  // Per-word audio files
}

// Preview Activity Types (pre-listening warm-up)
export type PreviewActivityType = 'prediction' | 'wordAssociation' | 'trueFalse';

export interface PredictionItem {
  id: string;
  question: string;                // Personal/opinion question
  questionArabic?: string;         // Arabic translation
  options: string[];               // 2-3 short answer options (no correct answer)
}

export interface WordAssociationItem {
  id: string;
  word: string;                    // Word to display
  inDialogue: boolean;             // true if word appears in transcript
}

export interface TrueFalseItem {
  id: string;
  statement: string;               // Statement about dialogue content
  statementArabic?: string;        // Arabic translation
  correctAnswer: boolean;          // true or false
}

export interface PreviewActivity {
  type: PreviewActivityType;
  items: PredictionItem[] | WordAssociationItem[] | TrueFalseItem[];
}

export interface ClassroomActivity {
  situationSetup: { en: string; ar: string };
  discussionPrompt: { en: string; ar: string };
  audioEn?: string;   // Base64 data URL for English TTS
  audioAr?: string;   // Base64 data URL for Arabic TTS
}

export interface ListeningTest {
  id: string;
  audioId?: string | null;
  title: string;
  type: TestType;
  questions: TestQuestion[];
  lexis?: LexisItem[];             // Optional vocabulary items
  lexisAudio?: LexisAudio;         // Generated vocabulary audio
  preview?: PreviewActivity[];     // Pre-listening/pre-reading preview activities
  classroomActivity?: ClassroomActivity; // Pre-activity classroom discussion
  transferQuestion?: { en: string; ar: string; audioEn?: string; audioAr?: string }; // Plenary transfer question for whole-class discussion
  speakerCount?: number | null;    // Number of speakers (null for reading tests)
  sourceText?: string;             // Reading passage (null for listening tests)
  difficulty?: string;             // CEFR level (A1, A2, B1, B2, C1)
  createdAt: string;
  updatedAt: string;
}

export interface TestAttempt {
  testId: string;
  answers: { [questionId: string]: string };
  score?: number;
  completedAt?: string;
}

// === Session Performance Log Types ===

export interface MatchPhaseItemResult {
  lexisItemId: string;
  term: string;
  attemptsBeforeMatch: number;
  matched: boolean;
}

export interface MatchPhaseResult {
  completed: boolean;
  totalAttempts: number;
  items: MatchPhaseItemResult[];
}

export interface GapFillPhaseItemResult {
  lexisItemId: string;
  term: string;
  selectedAnswer: string;
  correct: boolean;
  usedHint: boolean;
}

export interface GapFillPhaseResult {
  completed: boolean;
  items: GapFillPhaseItemResult[];
}

export interface PreviewPredictionResult {
  itemId: string;
  question: string;
  selectedOption: string;
}

export interface PreviewWordAssocResult {
  itemId: string;
  word: string;
  inDialogue: boolean;
  studentSelected: boolean;
  correct: boolean;
}

export interface PreviewTrueFalseResult {
  itemId: string;
  statement: string;
  correctAnswer: boolean;
  studentAnswer: boolean | null;
  correct: boolean;
}

export interface PreviewPhaseResult {
  completed: boolean;
  prediction?: PreviewPredictionResult[];
  wordAssociation?: PreviewWordAssocResult[];
  trueFalse?: PreviewTrueFalseResult[];
}

export interface QuestionsItemResult {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  studentAnswer: string;
  correct: boolean;
}

export interface QuestionsPhaseResult {
  score: number;
  items: QuestionsItemResult[];
}

export interface TestSessionLog {
  testId: string;
  match?: MatchPhaseResult;
  gapFill?: GapFillPhaseResult;
  preview?: PreviewPhaseResult;
  questions?: QuestionsPhaseResult;
}

// Follow-up discussion questions (post-test, Bloom's taxonomy progression)
export interface FollowUpQuestion {
  id: string;
  type: 'connect' | 'compare' | 'judge';
  question: string;
  questionArabic?: string;
  starters?: string[];
}

export interface FollowUpFeedbackItem {
  questionId: string;
  acknowledge: string;
  acknowledgeArabic: string;
  connectToTest: string;
  connectToTestArabic: string;
  extendThinking: string;
  extendThinkingArabic: string;
  vocabularyWord: string;
  vocabularyDefinition: string;
  vocabularyDefinitionArabic: string;
  vocabularySentence: string;
  vocabularySentenceArabic: string;
}