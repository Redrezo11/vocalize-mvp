import React, { useState, useCallback } from 'react';
import { CEFRLevel, ContentMode } from './Settings';
import { EngineType, SavedAudio, SpeakerVoiceMapping } from '../types';
import { parseDialogue } from '../utils/parser';

const API_BASE = '/api';

interface OneShotCreatorProps {
  isOpen: boolean;
  defaultDifficulty: CEFRLevel;
  contentMode: ContentMode;
  onClose: () => void;
  onComplete: (result: { audioEntry: SavedAudio; test: any }) => void;
}

// --- Processing stages ---
type ProcessingStage = 'idle' | 'parsing' | 'generating-audio' | 'saving-audio' | 'creating-test' | 'done' | 'error';

const STAGE_CONFIG: Record<ProcessingStage, { label: string; labelAr: string; progress: number }> = {
  idle: { label: '', labelAr: '', progress: 0 },
  parsing: { label: 'Parsing response...', labelAr: 'جاري التحليل...', progress: 10 },
  'generating-audio': { label: 'Generating audio...', labelAr: 'جاري إنشاء الصوت...', progress: 40 },
  'saving-audio': { label: 'Saving audio...', labelAr: 'جاري حفظ الصوت...', progress: 70 },
  'creating-test': { label: 'Creating test...', labelAr: 'جاري إنشاء الاختبار...', progress: 85 },
  done: { label: 'Complete!', labelAr: 'تم!', progress: 100 },
  error: { label: 'Error', labelAr: 'خطأ', progress: 0 },
};

// --- CEFR descriptions ---
const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

const CEFR_DESCRIPTIONS: Record<CEFRLevel, string> = {
  'A1': 'Beginner - Basic phrases, simple present tense, very common vocabulary',
  'A2': 'Elementary - Simple sentences, past tense, everyday topics',
  'B1': 'Intermediate - Connected speech, opinions, familiar topics',
  'B2': 'Upper-Intermediate - Complex ideas, abstract topics, natural speech',
  'C1': 'Advanced - Nuanced language, idiomatic expressions, sophisticated topics',
};

const CEFR_PROMPT_GUIDELINES: Record<CEFRLevel, string> = {
  'A1': 'Use only basic vocabulary (500 most common words). Simple present tense only. Very short sentences (5-8 words). Speak slowly and clearly with frequent pauses.',
  'A2': 'Use common everyday vocabulary (1000 most common words). Simple past and present tenses. Short sentences (8-12 words). Clear pronunciation with some natural pausing.',
  'B1': 'Use moderately complex language. Mix of tenses including present perfect. Sentences of 10-15 words. Natural pace with some connected speech. Include common idioms.',
  'B2': 'Use complex sentence structures. All tenses including conditionals and passive voice. Natural speech rate. Include abstract vocabulary and some idiomatic expressions.',
  'C1': 'Use sophisticated, nuanced language. Complex grammar including subjunctive and mixed conditionals. Fast natural speech with contractions and connected speech. Idiomatic and colloquial expressions.',
};

// --- Gemini voice reference (embedded for template) ---
const GEMINI_VOICES_REFERENCE = `
FEMALE VOICES:
- Aoede: Breezy, relaxed, casual dialogues
- Kore: Firm, confident, teachers/authority
- Leda: Youthful, curious, students/teenagers
- Zephyr: Bright, optimistic, cheerful characters
- Autonoe: Warm, nurturing, mothers/counselors
- Callirhoe: Gentle, patient, children's content
- Despina: Smooth, polished, business/professional
- Erinome: Clear, articulate, educational content

MALE VOICES:
- Puck: Upbeat, energetic, young characters
- Charon: Informative, knowledgeable, educational narration
- Fenrir: Excitable, high-energy, action/sports
- Orus: Firm, commanding, authority figures
- Achird: Friendly, warm, helpful guides
- Algieba: Smooth, polished, business professionals
- Alnilam: Firm, formal, official announcements
- Umbriel: Relaxed, laid-back, casual conversations
- Zubenelgenubi: Casual, everyday, informal settings

PAIRING GUIDE:
- Teacher + Student: Kore + Puck or Charon + Leda
- Friends chatting: Aoede + Zephyr or Umbriel + Zubenelgenubi
- Boss + Employee: Orus + Achird or Despina + Zephyr
- Expert + Learner: Charon + Leda or Erinome + Puck
- Customer service: Achird + Zubenelgenubi or Autonoe + Aoede
`.trim();

// --- Helpers ---
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface OneShotPayload {
  title: string;
  difficulty: CEFRLevel;
  transcript: string;
  voiceAssignments: Record<string, string>;
  questions: Array<{
    questionText: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    explanationArabic?: string;
  }>;
  lexis: Array<{
    term: string;
    definition: string;
    definitionArabic?: string;
    hintArabic?: string;
    explanation?: string;
    explanationArabic?: string;
    example?: string;
    partOfSpeech?: string;
  }>;
}

function validatePayload(jsonText: string): OneShotPayload {
  // Strip markdown code fences
  let cleaned = jsonText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  if (!parsed.title || typeof parsed.title !== 'string') throw new Error('Missing "title"');
  if (!parsed.transcript || typeof parsed.transcript !== 'string') throw new Error('Missing "transcript"');
  if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Missing or empty "questions" array');
  }

  parsed.questions.forEach((q: any, i: number) => {
    if (!q.questionText) throw new Error(`Question ${i + 1}: missing "questionText"`);
    if (!q.options || !Array.isArray(q.options) || q.options.length < 2) throw new Error(`Question ${i + 1}: needs at least 2 options`);
    if (!q.correctAnswer) throw new Error(`Question ${i + 1}: missing "correctAnswer"`);
    if (!q.options.includes(q.correctAnswer)) throw new Error(`Question ${i + 1}: correctAnswer "${q.correctAnswer}" doesn't match any option`);
  });

  if (!parsed.difficulty) parsed.difficulty = 'B1';
  if (!parsed.voiceAssignments) parsed.voiceAssignments = {};
  if (!parsed.lexis) parsed.lexis = [];

  return parsed as OneShotPayload;
}

// --- Build guidelines template ---
function buildTemplate(difficulty: CEFRLevel, contentMode: ContentMode): string {
  const contentGuidelines = contentMode === 'halal'
    ? `\nCONTENT RESTRICTIONS (Halal mode):\n- No references to alcohol, pork, gambling, dating, or romantic relationships\n- Topics should be family-friendly and culturally appropriate\n- Avoid slang related to prohibited topics\n`
    : contentMode === 'elsd'
    ? `\nCONTENT RESTRICTIONS (ELSD - KSU University standards):\n- Academic and professionally appropriate content only\n- No controversial political, religious, or social topics\n- Focus on educational, practical, and workplace scenarios\n`
    : '';

  return `# One-Shot EFL Listening Test Generator

## Your Task
Create a COMPLETE listening test package: a dialogue transcript, voice assignments, comprehension questions, and vocabulary items.

## Target Level: ${difficulty} - ${CEFR_DESCRIPTIONS[difficulty]}

### Language Guidelines for ${difficulty}:
${CEFR_PROMPT_GUIDELINES[difficulty]}
${contentGuidelines}
## Available TTS Voices (Gemini)
Choose appropriate voices for your speakers from this list:

${GEMINI_VOICES_REFERENCE}

## Output Format

Return a SINGLE JSON object. No markdown fences, no explanation — ONLY valid JSON.

{
  "title": "Descriptive title for the listening exercise",
  "difficulty": "${difficulty}",
  "transcript": "Speaker1: First line of dialogue.\\n\\nSpeaker2: Response line.\\n\\nSpeaker1: Another line.",
  "voiceAssignments": {
    "Speaker1": "VoiceName",
    "Speaker2": "VoiceName"
  },
  "questions": [
    {
      "questionText": "What did the speakers discuss?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "explanation": "English explanation of why this is correct",
      "explanationArabic": "شرح بالعربية"
    }
  ],
  "lexis": [
    {
      "term": "vocabulary word",
      "definition": "Clear English definition for ${difficulty} learners",
      "definitionArabic": "كلمة عربية",
      "hintArabic": "شرح التعريف بالعربية",
      "explanation": "Why this word matters or how it's used",
      "explanationArabic": "شرح مختصر بالعربية",
      "example": "Example sentence using the word",
      "partOfSpeech": "noun/verb/adjective/adverb/phrase"
    }
  ]
}

## Dialogue Guidelines
- Use exactly 2 speakers with contrasting voice types
- Target ~180-220 words (about 1.5 minutes of audio)
- Use "Speaker: text" format with \\n\\n between turns
- Include natural fillers (um, well, you know) for realism
- No stage directions, sound effects, or meta-commentary
- Just pure dialogue text

## Question Guidelines
- Generate 5-8 multiple-choice comprehension questions
- Each question must have exactly 4 options
- correctAnswer must match one option exactly (character-for-character)
- Test comprehension: main ideas, specific details, speaker attitudes, and inferences
- Include explanations in English and Arabic for wrong answers

## Vocabulary Guidelines
- Select 5-12 key vocabulary items from the dialogue
- Focus on words ${difficulty} learners would need to learn
- definitionArabic: Just the Arabic word/phrase (e.g., "travel" → "يسافر")
- hintArabic: Arabic translation of the English definition
- Include part of speech for each item

## Voice Selection
- Pick 2 voices that create good contrast (e.g., one male + one female)
- Match voice personality to the character's role in the dialogue

Now generate the complete test as a single JSON object:`;
}

// --- Component ---
export const OneShotCreator: React.FC<OneShotCreatorProps> = ({
  isOpen,
  defaultDifficulty,
  contentMode,
  onClose,
  onComplete,
}) => {
  const [difficulty, setDifficulty] = useState<CEFRLevel>(defaultDifficulty);
  const [pasteContent, setPasteContent] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCopyTemplate = useCallback(async () => {
    const template = buildTemplate(difficulty, contentMode);
    try {
      await navigator.clipboard.writeText(template);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = template;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  }, [difficulty, contentMode]);

  const processOneShot = useCallback(async () => {
    setErrorMsg('');

    // Stage 1: Parse
    setStage('parsing');
    let payload: OneShotPayload;
    try {
      payload = validatePayload(pasteContent);
    } catch (err) {
      setErrorMsg(`Parse error: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
      setStage('error');
      return;
    }

    // Stage 2: Generate audio
    setStage('generating-audio');
    let audioBlob: Blob | null = null;
    const analysis = parseDialogue(payload.transcript);
    const speakerMapping: SpeakerVoiceMapping = {};

    // Map voice assignments
    for (const [speaker, voice] of Object.entries(payload.voiceAssignments)) {
      speakerMapping[speaker] = voice;
    }

    try {
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (apiKey && apiKey !== 'PLACEHOLDER_API_KEY') {
        const { GoogleGenAI, Modality } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        // Build multi-speaker config
        const speakers = Object.entries(speakerMapping);
        const speechConfig = speakers.length === 2
          ? {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: speakers.map(([speaker, voice]) => ({
                  speaker,
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                })),
              },
            }
          : {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: speakers[0]?.[1] || 'Puck' },
              },
            };

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: payload.transcript,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig,
          },
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          // PCM to WAV conversion
          const pcmBytes = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
          const sampleRate = 24000;
          const numChannels = 1;
          const bitsPerSample = 16;
          const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
          const blockAlign = numChannels * (bitsPerSample / 8);
          const dataSize = pcmBytes.length;
          const buffer = new ArrayBuffer(44 + dataSize);
          const view = new DataView(buffer);

          const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
          };

          writeString(0, 'RIFF');
          view.setUint32(4, 36 + dataSize, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, byteRate, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, bitsPerSample, true);
          writeString(36, 'data');
          view.setUint32(40, dataSize, true);
          new Uint8Array(buffer, 44).set(pcmBytes);

          audioBlob = new Blob([buffer], { type: 'audio/wav' });
        }
      }
    } catch (err) {
      console.warn('[OneShot] Audio generation failed, continuing as transcript-only:', err);
      // Continue without audio
    }

    // Stage 3: Save audio entry
    setStage('saving-audio');
    let audioEntry: SavedAudio;
    try {
      let audioData: string | null = null;
      if (audioBlob) {
        audioData = await blobToBase64(audioBlob);
      }

      const response = await fetch(`${API_BASE}/audio-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          transcript: payload.transcript,
          audio_data: audioData,
          engine: audioBlob ? EngineType.GEMINI : EngineType.BROWSER,
          speaker_mapping: speakerMapping,
          speakers: analysis.speakers,
          is_transcript_only: !audioBlob,
          difficulty: payload.difficulty,
        }),
      });

      if (!response.ok) throw new Error('Failed to save audio entry');
      const data = await response.json();
      audioEntry = {
        id: data._id,
        title: data.title,
        transcript: data.transcript,
        audioUrl: data.audio_data ? `data:audio/wav;base64,${data.audio_data}` : null,
        engine: data.engine || EngineType.BROWSER,
        speakerMapping: data.speaker_mapping || {},
        speakers: data.speakers || [],
        isTranscriptOnly: data.is_transcript_only || false,
        difficulty: data.difficulty,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      setErrorMsg(`Failed to save audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStage('error');
      return;
    }

    // Stage 4: Create test
    setStage('creating-test');
    try {
      const testData = {
        audioId: audioEntry.id,
        title: payload.title,
        type: 'listening-comprehension',
        questions: payload.questions.map(q => ({
          ...q,
          id: generateId(),
        })),
        lexis: payload.lexis.length > 0
          ? payload.lexis.map(l => ({
              ...l,
              id: generateId(),
            }))
          : undefined,
      };

      const response = await fetch(`${API_BASE}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      });

      if (!response.ok) throw new Error('Failed to create test');
      const savedTest = await response.json();

      setStage('done');
      onComplete({ audioEntry, test: savedTest });
    } catch (err) {
      setErrorMsg(`Failed to create test: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStage('error');
      return;
    }
  }, [pasteContent, onComplete]);

  if (!isOpen) return null;

  const isProcessing = stage !== 'idle' && stage !== 'error' && stage !== 'done';
  const stageInfo = STAGE_CONFIG[stage];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-5 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">One Shot Creator</h2>
            <p className="text-sm text-white/80">Complete test in one step</p>
          </div>
          {!isProcessing && stage !== 'done' && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" x2="6" y1="6" y2="18" />
                <line x1="6" x2="18" y1="6" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Phase 1: Template & Import */}
          {stage === 'idle' && (
            <div className="space-y-6">
              {/* Step 1: Configure & Copy */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  <h3 className="font-semibold text-slate-900">Copy Guidelines</h3>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-sm text-slate-600">Difficulty:</label>
                  <div className="flex gap-1">
                    {CEFR_LEVELS.map(level => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          difficulty === level
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleCopyTemplate}
                  className={`w-full p-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                    copyFeedback
                      ? 'bg-green-100 text-green-700 border-2 border-green-300'
                      : 'bg-rose-50 text-rose-700 border-2 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
                  }`}
                >
                  {copyFeedback ? 'Copied! Now paste into your LLM' : 'Copy Guidelines to Clipboard'}
                </button>
              </div>

              {/* Step 2: Paste response */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <h3 className="font-semibold text-slate-900">Paste LLM Response</h3>
                </div>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder='Paste the JSON response from your LLM here...'
                  className="w-full h-48 p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-mono text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Step 3: Create */}
              <button
                onClick={processOneShot}
                disabled={!pasteContent.trim()}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl font-bold text-lg hover:from-rose-400 hover:to-pink-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Create Test
              </button>
            </div>
          )}

          {/* Phase 2: Processing */}
          {(isProcessing || stage === 'done') && (
            <div className="space-y-8 py-4">
              <div className="text-center">
                {stage === 'done' ? (
                  <div className="text-5xl mb-4">&#9889;</div>
                ) : (
                  <div className="w-12 h-12 border-3 border-rose-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                )}
                <h3 className="text-lg font-bold text-slate-900">{stageInfo.label}</h3>
                <p className="text-sm text-slate-500 mt-1">{stageInfo.labelAr}</p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${stageInfo.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Parsing</span>
                  <span>Audio</span>
                  <span>Saving</span>
                  <span>Test</span>
                  <span>Done</span>
                </div>
              </div>

              {/* Stage-specific details */}
              <div className="space-y-2">
                {(['parsing', 'generating-audio', 'saving-audio', 'creating-test', 'done'] as ProcessingStage[]).map(s => {
                  const config = STAGE_CONFIG[s];
                  const isActive = s === stage;
                  const isDone = config.progress < stageInfo.progress || stage === 'done';
                  return (
                    <div key={s} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-rose-50' : ''}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isDone ? 'bg-green-500 text-white' : isActive ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-400'
                      }`}>
                        {isDone ? '\u2713' : ''}
                      </span>
                      <span className={`text-sm ${isActive ? 'text-rose-700 font-medium' : isDone ? 'text-green-700' : 'text-slate-400'}`}>
                        {config.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error state */}
          {stage === 'error' && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <div className="text-5xl mb-4">&#9888;&#65039;</div>
                <h3 className="text-lg font-bold text-red-700">Something went wrong</h3>
                <p className="text-sm text-red-500 mt-2 max-w-md mx-auto">{errorMsg}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setStage('idle')}
                  className="px-6 py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-400 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OneShotCreator;
