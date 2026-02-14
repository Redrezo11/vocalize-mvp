import React, { useState, useCallback, useMemo } from 'react';
import { CEFRLevel, ContentMode } from './Settings';
import { EngineType, SavedAudio, SpeakerVoiceMapping } from '../types';
import { parseDialogue } from '../utils/parser';
import { EFL_TOPICS, SpeakerCount, AudioFormat, getRandomTopic, getRandomFormat, shuffleFormat, randomSpeakerCount, resolveSpeakerDefault } from '../utils/eflTopics';
import type { SpeakerCountDefault } from './Settings';

const API_BASE = '/api';

interface OneShotCreatorProps {
  isOpen: boolean;
  defaultDifficulty: CEFRLevel;
  contentMode: ContentMode;
  defaultSpeakerCount?: SpeakerCountDefault;
  onClose: () => void;
  onComplete: (result: { audioEntry: SavedAudio; test: any }) => void;
}

// --- Processing stages ---
type ProcessingStage = 'idle' | 'parsing' | 'generating-audio' | 'audio_failed' | 'saving-audio' | 'creating-test' | 'done' | 'error';

const STAGE_CONFIG: Record<ProcessingStage, { label: string; labelAr: string; progress: number }> = {
  idle: { label: '', labelAr: '', progress: 0 },
  parsing: { label: 'Parsing response...', labelAr: 'جاري التحليل...', progress: 10 },
  'generating-audio': { label: 'Generating audio...', labelAr: 'جاري إنشاء الصوت...', progress: 40 },
  audio_failed: { label: 'Audio generation failed', labelAr: 'فشل إنشاء الصوت', progress: 40 },
  'saving-audio': { label: 'Saving audio...', labelAr: 'جاري حفظ الصوت...', progress: 70 },
  'creating-test': { label: 'Creating test...', labelAr: 'جاري إنشاء الاختبار...', progress: 85 },
  done: { label: 'Complete!', labelAr: 'تم!', progress: 100 },
  error: { label: 'Error', labelAr: 'خطأ', progress: 0 },
};

// --- CEFR descriptions ---
const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

const CEFR_DESCRIPTIONS: Record<CEFRLevel, string> = {
  'A1': 'Beginner - Very common vocabulary, simple clear language',
  'A2': 'Elementary - Everyday vocabulary, straightforward language',
  'B1': 'Intermediate - Broader vocabulary, expressing opinions and experiences',
  'B2': 'Upper-Intermediate - Wide vocabulary, complex ideas, natural speech',
  'C1': 'Advanced - Rich vocabulary, idiomatic expressions, nuanced language',
};

// Exported for use by JamButton
export const CEFR_PROMPT_GUIDELINES: Record<CEFRLevel, string> = {
  'A1': 'Use the 500 most common English words. Keep sentences clear and easy to follow. Grammar must be correct and natural — do NOT artificially restrict tenses. Speak at a measured, clear pace.',
  'A2': 'Use the 1000 most common English words. Sentences should be straightforward but grammatically complete and natural. Include common phrasal verbs and collocations.',
  'B1': 'Use moderately varied vocabulary (~2000 words). Natural grammar — use whatever tenses fit the conversation. Include common idioms and connectors (however, although, despite).',
  'B2': 'Use a wide vocabulary including abstract and academic words. Fully natural grammar with complex sentences where appropriate. Include idiomatic expressions and nuanced word choices.',
  'C1': 'Use sophisticated, nuanced vocabulary including low-frequency words and field-specific terms. Fully natural speech with contractions, connected speech, colloquialisms, and subtle humor or irony.',
};

// --- Duration-based content guidelines ---
// Exported for use by JamButton and Settings
export const DURATION_GUIDELINES: Record<number, {
  wordCount: string;
  questions: string;
  lexis: string;
}> = {
  5:  { wordCount: '80-120',   questions: '3-4',  lexis: '3-5' },
  10: { wordCount: '180-220',  questions: '5-6',  lexis: '6-8' },
  15: { wordCount: '280-320',  questions: '7-8',  lexis: '8-10' },
  20: { wordCount: '330-380',  questions: '8-10', lexis: '10-12' },
  30: { wordCount: '420-480',  questions: '10-12', lexis: '12-15' },
};

// CEFR-based time adjustment factors
// Lower levels need more time per item, higher levels process faster
export const CEFR_TIME_ADJUSTMENTS: Record<CEFRLevel, {
  factor: number;
  description: string;
}> = {
  'A1': { factor: 1.4, description: 'Students need 40% more time (slower reading, simpler content)' },
  'A2': { factor: 1.2, description: 'Students need 20% more time' },
  'B1': { factor: 1.0, description: 'Baseline timing' },
  'B2': { factor: 0.85, description: 'Students process 15% faster' },
  'C1': { factor: 0.7, description: 'Students process 30% faster, can handle more content' },
};

// Compute duration-adjusted content guidelines
export function getDurationGuidelines(
  targetMinutes: number,
  cefrLevel: CEFRLevel
): {
  wordCount: string;
  questionCount: string;
  lexisCount: string;
  explanation: string;
} {
  // Find nearest duration bucket (floor to nearest defined duration)
  const durations = Object.keys(DURATION_GUIDELINES).map(Number).sort((a, b) => a - b);
  let baseDuration = durations[0];
  for (const d of durations) {
    if (d <= targetMinutes) baseDuration = d;
    else break;
  }

  const base = DURATION_GUIDELINES[baseDuration];
  const adjustment = CEFR_TIME_ADJUSTMENTS[cefrLevel];

  // Apply CEFR adjustment: lower levels = fewer items (more time per item)
  // Higher levels = more items (less time per item)
  const adjustFactor = 1 / adjustment.factor;

  const [qMin, qMax] = base.questions.split('-').map(Number);
  const [lMin, lMax] = base.lexis.split('-').map(Number);

  const adjustedQMin = Math.max(2, Math.round(qMin * adjustFactor));
  const adjustedQMax = Math.max(3, Math.round(qMax * adjustFactor));
  const adjustedLMin = Math.max(2, Math.round(lMin * adjustFactor));
  const adjustedLMax = Math.max(3, Math.round(lMax * adjustFactor));

  return {
    wordCount: base.wordCount,
    questionCount: `${adjustedQMin}-${adjustedQMax}`,
    lexisCount: `${adjustedLMin}-${adjustedLMax}`,
    explanation: adjustment.description,
  };
}

// --- Gemini voice reference (embedded for template) ---
// Exported for use by JamButton
// Based on docs/VOICE_ASSIGNMENT_GUIDE.md — all 30 Gemini voices with explicit gender tags
export const GEMINI_VOICES_REFERENCE = `
## FEMALE Voices (use ONLY for female characters):
- Aoede (Female): Breezy — casual narration, friendly neighbor, relaxed host
- Kore (Female): Firm — teacher, manager, news anchor, authority figure
- Leda (Female): Youthful — teenager, young adult, student
- Zephyr (Female): Bright — cheerful host, motivational, children's content
- Autonoe (Female): Warm — mother figure, counselor, mentor
- Callirhoe (Female): Gentle — caregiver, meditation guide, soft narrator
- Despina (Female): Smooth — business presenter, sophisticated host
- Erinome (Female): Clear — lecturer, tutor, documentary narrator
- Gacrux (Female): Mature — executive, elder, experienced professional
- Laomedeia (Female): Calm — wellness guide, therapist, mindfulness
- Pulcherrima (Female): Elegant — gala host, art curator, formal settings
- Sulafat (Female): Serene — nature documentary, peaceful content
- Vindemiatrix (Female): Refined — museum guide, literary reader
- Achernar (Female): Soft — confidant, bedtime narrator, poetry

## MALE Voices (use ONLY for male characters):
- Charon (Male): Informative — professor, historian, science explainer
- Achird (Male): Friendly — helpful guide, customer service, neighbor
- Orus (Male): Firm — military commander, CEO, serious announcer
- Fenrir (Male): Excitable — adventure narrator, gaming, thriller
- Puck (Male): Upbeat — game show host, sports commentator
- Algenib (Male): Gravelly — detective, cowboy, weathered veteran
- Algieba (Male): Smooth — radio DJ, luxury brand, suave character
- Alnilam (Male): Firm — lawyer, judge, formal announcer
- Enceladus (Male): Breathy — romantic lead, thriller narrator
- Iapetus (Male): Deep — movie trailer, villain, authoritative
- Rasalgethi (Male): Lively — talk show host, podcast, entertainer
- Sadachbia (Male): Clear — news reader, technical explainer
- Sadaltager (Male): Knowledgeable — expert, consultant, academic
- Schedar (Male): Professional — corporate training, business news
- Umbriel (Male): Relaxed — podcast host, casual guide
- Zubenelgenubi (Male): Casual — friend, everyday conversation

PAIRING GUIDE (for 2-speaker dialogues — pair one FEMALE + one MALE voice):
- Teacher + Student: Kore (Female) + Achird (Male) or Charon (Male) + Leda (Female)
- Friends chatting: Aoede (Female) + Umbriel (Male) or Zephyr (Female) + Zubenelgenubi (Male)
- Boss + Employee: Orus (Male) + Despina (Female) or Kore (Female) + Achird (Male)
- Expert + Learner: Erinome (Female) + Fenrir (Male) or Charon (Male) + Leda (Female)
- Customer service: Achird (Male) + Autonoe (Female) or Despina (Female) + Zubenelgenubi (Male)
- Professional: Schedar (Male) + Despina (Female) or Sadaltager (Male) + Erinome (Female)

MULTI-SPEAKER GUIDE (for 3+ speaker exercises):
- Use a mix of male and female voices for contrast (at least 1 of each gender)
- Assign different voice styles to each speaker for easy differentiation
- For a moderator/host role, use an authoritative voice (Kore, Orus, Schedar, Despina)
- For panelists/group members, vary between warm, energetic, and casual styles
- Avoid pairing two voices with similar archetypes (e.g., don't pair two "Firm" voices)
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

// Exported for use by JamButton
export interface OneShotPayload {
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
  preview?: Array<{
    type: 'prediction' | 'wordAssociation' | 'trueFalse';
    items: any[];
  }>;
  classroomActivity?: {
    situationSetup: { en: string; ar: string };
    discussionPrompt: { en: string; ar: string };
  };
  transferQuestion?: { en: string; ar: string };
}

// Exported for use by JamButton
export function validatePayload(jsonText: string): OneShotPayload {
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
  if (!parsed.preview) parsed.preview = [];
  if (!parsed.classroomActivity) parsed.classroomActivity = undefined;

  return parsed as OneShotPayload;
}

// --- Preview activity selection by difficulty ---
const getPreviewActivities = (difficulty: CEFRLevel): string => {
  switch (difficulty) {
    case 'A1':
    case 'A2':
      return 'prediction (simple personal questions) + wordAssociation (concrete nouns/verbs)';
    case 'B1':
    case 'B2':
      return 'wordAssociation (include collocations/phrasal verbs) + trueFalse (about dialogue content)';
    case 'C1':
      return 'trueFalse (inference-based) + prediction (abstract opinion questions)';
    default:
      return 'prediction + wordAssociation';
  }
};

// --- Build guidelines template ---
// Exported for use by JamButton
export function buildTemplate(
  difficulty: CEFRLevel,
  contentMode: ContentMode,
  targetDuration: number = 10,
  topic?: string,
  speakerCount: SpeakerCount = 2,
  audioFormat?: AudioFormat
): string {
  const contentGuidelines = contentMode === 'halal'
    ? `\nCONTENT RESTRICTIONS (Halal mode):\n- No references to alcohol, pork, gambling, dating, or romantic relationships\n- Topics should be family-friendly and culturally appropriate\n- Avoid slang related to prohibited topics\n`
    : contentMode === 'elsd'
    ? `\nCONTENT RESTRICTIONS (ELSD - KSU University standards):\n- Academic and professionally appropriate content only\n- No controversial political, religious, or social topics\n- Focus on educational, practical, and workplace scenarios\n`
    : '';

  const previewActivities = getPreviewActivities(difficulty);

  // Get duration-adjusted content guidelines
  const durationInfo = getDurationGuidelines(targetDuration, difficulty);

  return `# One-Shot EFL Listening Test Generator

## Your Task
Create a COMPLETE listening test package designed for approximately ${targetDuration} minutes of student activity time.

## Target Level: ${difficulty} - ${CEFR_DESCRIPTIONS[difficulty]}

## Duration Planning
- Target total duration: ${targetDuration} minutes
- CEFR level: ${difficulty} (${durationInfo.explanation})
- Calibrate content amounts for ${difficulty} students who ${difficulty === 'A1' || difficulty === 'A2' ? 'need more processing time per item' : difficulty === 'C1' ? 'process quickly and can handle more content' : 'have moderate processing speed'}

### Language Guidelines for ${difficulty}:
${CEFR_PROMPT_GUIDELINES[difficulty]}
${contentGuidelines}${audioFormat ? `## Audio Format: ${audioFormat.label}
${audioFormat.promptDescription}
Register: ${audioFormat.register}

` : ''}${topic ? `## Topic
Create the ${speakerCount === 1 ? 'monologue' : speakerCount === 3 ? 'group discussion' : 'dialogue'} about: "${topic}"
Make the specific scenario unique and engaging while staying on this topic.

` : ''}## Available TTS Voices (Gemini)
Choose appropriate voices for your speakers from this list:

${GEMINI_VOICES_REFERENCE}

## Output Format

Return a SINGLE JSON object. No markdown fences, no explanation — ONLY valid JSON.

{
  "title": "Descriptive title for the listening exercise",
  "difficulty": "${difficulty}",
  "transcript": "${speakerCount === 1 ? 'Speaker: Full monologue text here with natural pauses between sections.' : speakerCount === 3 ? 'Speaker1: First line.\\n\\nSpeaker2: Response.\\n\\nSpeaker3: Another perspective.\\n\\nSpeaker1: Follow-up.' : 'Speaker1: First line of dialogue.\\n\\nSpeaker2: Response line.\\n\\nSpeaker1: Another line.'}",
  "voiceAssignments": {
    ${speakerCount === 1 ? '"Speaker": "VoiceName"' : speakerCount === 3 ? '"Speaker1": "VoiceName",\n    "Speaker2": "VoiceName",\n    "Speaker3": "VoiceName"' : '"Speaker1": "VoiceName",\n    "Speaker2": "VoiceName"'}
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
  ],
  "preview": [
    {
      "type": "prediction",
      "items": [
        {
          "question": "Personal question connecting topic to student's life",
          "questionArabic": "سؤال شخصي بالعربية",
          "options": ["Short answer 1", "Short answer 2", "Short answer 3"]
        }
      ]
    },
    {
      "type": "wordAssociation",
      "items": [
        { "word": "word from dialogue", "inDialogue": true },
        { "word": "distractor word", "inDialogue": false }
      ]
    }
  ],
  "classroomActivity": {
    "situationSetup": { "en": "English situation description", "ar": "وصف الموقف بالعربية" },
    "discussionPrompt": { "en": "English discussion prompt", "ar": "سؤال النقاش بالعربية" }
  },
  "transferQuestion": {
    "en": "English transfer question",
    "ar": "سؤال النقل بالعربية"
  }
}

## ${speakerCount === 1 ? 'Monologue' : 'Dialogue'} Guidelines
- ${speakerCount === 1 ? 'Use exactly 1 speaker' : speakerCount === 3 ? 'Use 3-4 speakers with diverse, contrasting voices and distinct personalities' : 'Use exactly 2 speakers with contrasting voice types'}
- Target approximately ${durationInfo.wordCount} words for the ${speakerCount === 1 ? 'monologue' : 'dialogue'}
- Use "Speaker: text" format with \\n\\n between turns${speakerCount === 1 ? ' (use a single speaker name throughout)' : ''}
- Include natural ${speakerCount === 1 ? 'speech features (pauses, self-corrections, emphasis)' : 'fillers (um, well, you know)'} for realism
- No stage directions, sound effects, or meta-commentary
- Just pure ${speakerCount === 1 ? 'monologue' : 'dialogue'} text

## Question Guidelines
- Generate ${durationInfo.questionCount} multiple-choice comprehension questions
- Each question must have exactly 4 options
- correctAnswer must match one option exactly (character-for-character)
- Test comprehension: main ideas, specific details, speaker attitudes, and inferences
- Include explanations in English and Arabic for wrong answers
- Quantity calibrated for ${targetDuration}-minute test at ${difficulty} level

## Vocabulary Guidelines
- Select ${durationInfo.lexisCount} key vocabulary items from the dialogue
- Focus on words ${difficulty} learners would need to learn
- definitionArabic: Just the Arabic word/phrase (e.g., "travel" → "يسافر")
- hintArabic: Arabic translation of the English definition
- Include part of speech for each item
- Quantity calibrated for ${targetDuration}-minute test at ${difficulty} level

## Preview Activities Guidelines (Pre-Listening Warm-up)
Generate exactly 2 preview activities: ${previewActivities}

### Prediction Questions (if included)
- 2-3 personal/opinion questions connecting the topic to the student's life
- Include Arabic translation for each question
- 2-3 short answer options per question
- No correct answer — these are purely for engagement and schema activation

### Word Association (if included)
- 8-10 words total
- 4-5 words that actually appear in the transcript (inDialogue: true)
- 4-5 plausible distractor words NOT in the transcript (inDialogue: false)
- Can include 2-3 terms from the lexis for reinforcement

### True/False Predictions (if included)
- 3-4 statements about the dialogue content
- Mix of true and false statements
- Include correctAnswer boolean for each
- Include Arabic translation for each statement

IMPORTANT: Preview content must NOT duplicate or rephrase the comprehension questions.

## Classroom Activity (for teacher presentation mode)

Generate a collaborative pre-listening discussion task with two bilingual components:

1. "situationSetup" — One sentence (English + Arabic) describing WHO is in the listening and WHAT the situation is. Name roles (not character names) and the setting. Must be specific enough to activate the right schema but NOT reveal answers to any MCQ question.
   Good: "A university student visits a career advisor to ask for help choosing a job after graduation."
   Bad: "Two people talk about careers." (too vague)
   Bad: "Ahmed tells his advisor he wants to work in technology." (spoils content)

2. "discussionPrompt" — One question/instruction (English + Arabic) that places students inside the scenario. The prompt type depends on CEFR level:
   - A1-A2 (Personal Experience Retrieval): Ask students to share their own experience in the same domain. Use simple present/past tense. Plant 1-2 vocabulary words from the script naturally.
   - B1 (Empathetic Scenario Positioning): Place the student inside the scenario as a participant. Use conditional or hypothetical framing.
   - B2-C1 (Perspective-Taking / Counter-Argument): Require students to hold opposing positions simultaneously. Force perspective-taking.

   The prompt must be answerable by ANY student regardless of background. Keep to ONE sentence. Include Arabic translations for both fields.

## Transfer Question (plenary — whole-class discussion after all tasks)

Generate ONE question that takes the listening content and plants it into a new, adjacent scenario the students haven't encountered. This forces creative application (Bloom's Apply/Create). It is projected on the smartboard for teacher-facilitated class discussion.

The question type depends on CEFR level:
- A1-A2 (Concrete Personal Application): Take the specific situation from the listening and place the student in it. Simple, concrete, first-person. "You need to [situation from listening]. What would you...?"
- B1 (Applied Reasoning): Give a scenario adjacent to the listening — same domain, new stakeholders, unresolved problem. "The [entity] did [action from listening], but [new complication]. What might be going wrong?"
- B2-C1 (Abstract Transfer): Lift a principle from the listening and ask students to apply it to a broader category. "The speakers [did X]. Is this kind of [abstract pattern] always [judgment], or does it sometimes [alternative]?"

Rules:
- Must require knowledge FROM the listening to answer well
- Must NOT be answerable by just recalling what the speakers said
- Must place content into a context the listening never mentioned
- Keep to 1-2 sentences maximum
- Include Arabic translation

## Voice Selection Rules (CRITICAL)
${speakerCount === 1 ? `- Assign ONE voice that matches the speaker's character and gender
- Choose from the FEMALE or MALE voices list above based on the character
- Match voice personality to the character's role (see archetypes above)
- Vary your selections — do not always default to the same voice` : speakerCount === 3 ? `- Assign 3-4 distinct voices with a MIX of genders (at least 1 male and 1 female)
- Each speaker MUST have a clearly different voice style for easy differentiation
- Female characters MUST use a voice from the FEMALE voices list above
- Male characters MUST use a voice from the MALE voices list above
- NEVER assign a Female voice to a male character or vice versa
- For moderator/host roles, use an authoritative voice
- Vary your selections — do not pair voices with similar archetypes` : `- ALWAYS assign one FEMALE voice and one MALE voice for contrast
- Female characters MUST use a voice from the FEMALE voices list above
- Male characters MUST use a voice from the MALE voices list above
- NEVER assign a Female voice to a male character or vice versa
- Match voice personality to the character's role (see archetypes above)
- Vary your selections — do not always default to the same voices`}

Now generate the complete test as a single JSON object:`;
}

// --- Two-call prompt builders for JamButton pipeline ---
// These split the work into focused calls for better quality with smaller models

// Helper: content mode restrictions text
function getContentRestrictions(contentMode: ContentMode): string {
  if (contentMode === 'halal') {
    return `\nCONTENT RESTRICTIONS (Halal mode):\n- No references to alcohol, pork, gambling, dating, or romantic relationships\n- Topics should be family-friendly and culturally appropriate\n- Avoid slang related to prohibited topics\n`;
  }
  if (contentMode === 'elsd') {
    return `\nCONTENT RESTRICTIONS (ELSD - KSU University standards):\n- Academic and professionally appropriate content only\n- No controversial political, religious, or social topics\n- Focus on educational, practical, and workplace scenarios\n`;
  }
  return '';
}

/**
 * Call 1: Focused dialogue generation prompt.
 * Returns { instructions, input } for the Responses API.
 */
export function buildDialoguePrompt(
  difficulty: CEFRLevel,
  contentMode: ContentMode,
  targetDuration: number,
  topic?: string,
  speakerCount: SpeakerCount = 2,
  audioFormat?: AudioFormat
): { instructions: string; input: string } {
  const durationInfo = getDurationGuidelines(targetDuration, difficulty);
  const contentRestrictions = getContentRestrictions(contentMode);

  const scriptType = speakerCount === 1 ? 'monologues and single-speaker recordings' : speakerCount === 3 ? 'multi-party conversations involving 3-4 speakers' : 'conversations between two speakers';

  const instructions = `You are an expert scriptwriter for EFL (English as a Foreign Language) listening exercises. You create natural, engaging ${scriptType} that sound like real people talking. Your scripts are creative, topically varied, and perfectly calibrated to the target language proficiency level. You never produce generic or robotic exchanges.`;

  const input = `# Generate ${speakerCount === 1 ? 'a Monologue' : 'a Dialogue'} for an EFL Listening Exercise

## Target Level: ${difficulty} - ${CEFR_DESCRIPTIONS[difficulty]}

### Language Guidelines for ${difficulty}:
${CEFR_PROMPT_GUIDELINES[difficulty]}
${contentRestrictions}${audioFormat ? `
## Audio Format: ${audioFormat.label}
${audioFormat.promptDescription}
Register: ${audioFormat.register}
` : ''}
## Duration & Length
- Target duration: ${targetDuration} minutes of student activity
- ${speakerCount === 1 ? 'Monologue' : 'Dialogue'} word count: approximately ${durationInfo.wordCount} words

## Available TTS Voices (Gemini)
${GEMINI_VOICES_REFERENCE}

## ${speakerCount === 1 ? 'Monologue' : 'Dialogue'} Quality Standards
${topic ? `- Topic: "${topic}" — interpret this creatively, make the specific scenario unique and engaging
` : speakerCount === 1 ? `- Choose an engaging, SPECIFIC topic for the monologue
  - Good examples: "A tour guide describing a historical castle", "A voicemail about a change in travel plans", "A news report about a local festival"
  - Bad examples: "Someone talking about their day", "A generic announcement"
` : speakerCount === 3 ? `- Choose an engaging, SPECIFIC topic for the group discussion
  - Good examples: "Three students debating which topic to choose for their group project", "A panel discussing the future of electric vehicles", "Family members planning a vacation"
  - Bad examples: "People talking about stuff", "A group chat"
` : `- Choose an engaging, SPECIFIC topic (NOT generic small talk)
  - Good examples: "Negotiating a deadline extension with a professor", "Debating whether to adopt a rescue dog", "Planning a surprise birthday party that's going wrong"
  - Bad examples: "Two people talking about their day", "A conversation about weather"
`}${speakerCount === 1 ? `- Give the speaker a clear personality and role
  - Use a real character name (e.g., "Sarah"), NOT "Speaker1" or "Narrator"
  - The speaker should have a clear purpose and audience in mind
- Create a natural arc:
  - Opening: establish context quickly
  - Middle: develop the main content with natural progression
  - End: reach a clear conclusion or sign-off
- Include natural speech features appropriate for ${difficulty} level:
  - Pauses and self-corrections
  - Emphasis words: "actually", "importantly", "what I mean is"
  - Transitions: "now", "moving on", "so anyway"` : speakerCount === 3 ? `- Give each speaker a DISTINCT personality and role:
  - Different speaking styles and levels of formality
  - Different attitudes or perspectives on the topic
  - Use real character names (e.g., "Sarah", "Marcus", "James"), NOT "Speaker1/Speaker2/Speaker3"
  - If the format has a moderator/host, make that role clear
- Create a natural group conversation arc:
  - Opening: establish the context and let speakers introduce their perspectives
  - Middle: develop with genuine multi-way exchange, agreements, disagreements
  - End: reach some resolution, decision, or summary
- Vary turn lengths realistically:
  - Mix short reactions with longer explanations
  - NOT every speaker should talk equally
- Include natural speech features appropriate for ${difficulty} level:
  - Interruptions and overlapping: "Sorry, can I just—", "Wait, let me finish"
  - Backchanneling: "Mm-hmm", "Right", "I see"
  - Referring to other speakers: "Like Sarah said...", "I agree with Marcus on that"` : `- Give each speaker a DISTINCT personality:
  - Different speaking styles (one more formal, one more casual; one verbose, one concise)
  - Different attitudes or perspectives on the topic
  - Use real character names (e.g., "Sarah", "Marcus"), NOT "Speaker1/Speaker2"
- Create a natural conversation arc:
  - Opening: jump straight into the situation (NOT "Hello, how are you?")
  - Middle: develop the topic with genuine back-and-forth, disagreements, discoveries
  - End: reach a natural resolution, decision, or conclusion
- Vary turn lengths realistically:
  - Mix short reactions ("Really? That's surprising.") with longer explanations
  - NOT every turn should be the same length
- Include natural speech features appropriate for ${difficulty} level:
  - Fillers: "um", "well", "you know", "I mean"
  - Self-corrections: "It was Monday — no wait, Tuesday"
  - Reactions: "Oh!", "Hmm", "Right, right"
  - Backchanneling and overlapping ideas`}
- AVOID:
  - Robotic, equal-length ping-pong exchanges
  - ${speakerCount === 1 ? 'Monotonous delivery without variation' : 'Characters that sound identical'}
  - Exposition dumps disguised as ${speakerCount === 1 ? 'narration' : 'dialogue'}
  - ${speakerCount === 1 ? 'Reading from a script (should sound natural and spoken)' : 'Starting with greetings or pleasantries'}
  - Overly educational or "textbook" sounding exchanges

## Voice Selection Rules (CRITICAL)
${speakerCount === 1 ? `- Assign ONE voice that matches the speaker's character and gender
- Choose from the FEMALE or MALE voices list above based on the character
- Match voice personality to the character's role (see archetypes above)` : speakerCount === 3 ? `- Assign 3-4 distinct voices with a MIX of genders (at least 1 male and 1 female)
- Each speaker MUST have a clearly different voice style for easy differentiation
- Female characters MUST use a voice from the FEMALE voices list above
- Male characters MUST use a voice from the MALE voices list above
- NEVER assign a Female voice to a male character or vice versa
- For moderator/host roles, use an authoritative voice
- Vary your selections — do not pair voices with similar archetypes` : `- ALWAYS assign one FEMALE voice and one MALE voice for contrast
- Female characters MUST use a voice from the FEMALE voices list above
- Male characters MUST use a voice from the MALE voices list above
- NEVER assign a Female voice to a male character or vice versa
- Match voice personality to the character's role (see archetypes above)
- Vary your selections — do not always default to the same voices`}

## Output Format

Return a SINGLE JSON object with ONLY these fields. No markdown fences, no explanation — ONLY valid JSON.

{
  "title": "Descriptive title for the listening exercise",
  "difficulty": "${difficulty}",
  "transcript": "${speakerCount === 1 ? 'CharName: Full monologue text with natural pauses between sections.' : speakerCount === 3 ? 'CharName1: First line.\\n\\nCharName2: Response.\\n\\nCharName3: Another perspective.\\n\\nCharName1: Follow-up.' : 'CharName1: First line of dialogue.\\n\\nCharName2: Response line.\\n\\nCharName1: Another line.'}",
  "voiceAssignments": {
    ${speakerCount === 1 ? '"CharName": "VoiceName"' : speakerCount === 3 ? '"CharName1": "VoiceName",\n    "CharName2": "VoiceName",\n    "CharName3": "VoiceName"' : '"CharName1": "VoiceName",\n    "CharName2": "VoiceName"'}
  }
}

Use "Speaker: text" format with \\n\\n between turns. No stage directions, sound effects, or meta-commentary — just pure ${speakerCount === 1 ? 'monologue' : 'dialogue'} text.

Now generate the ${speakerCount === 1 ? 'monologue' : 'dialogue'} as a single JSON object:`;

  return { instructions, input };
}

/**
 * Call 2: Test content generation prompt (questions, lexis, preview).
 * Takes the dialogue from Call 1 as input context.
 */
export function buildTestContentPrompt(
  dialogue: { title: string; transcript: string; difficulty: CEFRLevel },
  contentMode: ContentMode,
  targetDuration: number
): { instructions: string; input: string } {
  const durationInfo = getDurationGuidelines(targetDuration, dialogue.difficulty);
  const contentRestrictions = getContentRestrictions(contentMode);
  const previewActivities = getPreviewActivities(dialogue.difficulty);

  const instructions = `You are an expert EFL (English as a Foreign Language) test designer. Given a dialogue transcript, you create pedagogically sound comprehension questions, vocabulary exercises, and preview activities calibrated to the student's CEFR level. Your questions test genuine comprehension — main ideas, inferences, speaker attitudes — not just surface-level recall.`;

  const input = `# Generate Test Content for an EFL Listening Exercise

## Context
A dialogue has already been created. Your job is to generate the test content (questions, vocabulary, and preview activities) based on this specific dialogue.

## Target Level: ${dialogue.difficulty} - ${CEFR_DESCRIPTIONS[dialogue.difficulty]}
${contentRestrictions}
## The Dialogue

Title: "${dialogue.title}"

${dialogue.transcript}

## Question Guidelines
- Generate ${durationInfo.questionCount} multiple-choice comprehension questions about the dialogue above
- Each question must have exactly 4 options
- correctAnswer must match one option exactly (character-for-character)
- Test comprehension at multiple levels:
  - Main ideas and overall theme
  - Specific details mentioned by speakers
  - Speaker attitudes, opinions, and emotions
  - Inferences and implied meaning
- Include explanations in English and Arabic for why the correct answer is right
- Questions should require actually listening to/reading the dialogue to answer (not guessable)

## Vocabulary Guidelines
- Select ${durationInfo.lexisCount} key vocabulary items FROM the dialogue above
- Focus on words ${dialogue.difficulty} learners would benefit from learning
- definitionArabic: Just the Arabic word/phrase (e.g., "travel" → "يسافر")
- hintArabic: Arabic translation of the English definition
- Include part of speech for each item

## Preview Activities Guidelines (Pre-Listening Warm-up)
Generate exactly 2 preview activities: ${previewActivities}

### Prediction Questions (if included)
- 2-3 personal/opinion questions connecting the topic to the student's life
- Include Arabic translation for each question
- 2-3 short answer options per question
- No correct answer — these are purely for engagement and schema activation

### Word Association (if included)
- 8-10 words total
- 4-5 words that actually appear in the transcript (inDialogue: true)
- 4-5 plausible distractor words NOT in the transcript (inDialogue: false)

### True/False Predictions (if included)
- 3-4 statements about the dialogue content
- Mix of true and false statements
- Include correctAnswer boolean for each
- Include Arabic translation for each statement

IMPORTANT: Preview content must NOT duplicate or rephrase the comprehension questions.

## Classroom Activity (for teacher presentation mode)

Generate a collaborative pre-listening discussion task with two bilingual components:

1. "situationSetup" — One sentence (English + Arabic) describing WHO is in the listening and WHAT the situation is. Names roles (not character names) and the setting. Must be specific enough to activate the right schema but NOT reveal answers to any MCQ question.
   Good: "A university student visits a career advisor to ask for help choosing a job after graduation."
   Bad: "Two people talk about careers." (too vague)
   Bad: "Ahmed tells his advisor he wants to work in technology." (spoils content)

2. "discussionPrompt" — One question/instruction (English + Arabic) that places students inside the scenario. The prompt type depends on CEFR level:
   - A1-A2 (Personal Experience Retrieval): Ask students to share their own experience in the same domain. Use simple present/past tense. Plant 1-2 vocabulary words from the script naturally.
   - B1 (Empathetic Scenario Positioning): Place the student inside the scenario as a participant. Use conditional or hypothetical framing.
   - B2-C1 (Perspective-Taking / Counter-Argument): Require students to hold opposing positions simultaneously. Force perspective-taking.

   The prompt must be answerable by ANY student regardless of background. Keep to ONE sentence. Include Arabic translations for both fields.

## Transfer Question (plenary — whole-class discussion after all tasks)

Generate ONE question that takes the listening content and plants it into a new, adjacent scenario the students haven't encountered. This forces creative application (Bloom's Apply/Create). It is projected on the smartboard for teacher-facilitated class discussion.

The question type depends on CEFR level:
- A1-A2 (Concrete Personal Application): Take the specific situation from the listening and place the student in it. Simple, concrete, first-person. "You need to [situation from listening]. What would you...?"
- B1 (Applied Reasoning): Give a scenario adjacent to the listening — same domain, new stakeholders, unresolved problem. "The [entity] did [action from listening], but [new complication]. What might be going wrong?"
- B2-C1 (Abstract Transfer): Lift a principle from the listening and ask students to apply it to a broader category. "The speakers [did X]. Is this kind of [abstract pattern] always [judgment], or does it sometimes [alternative]?"

Rules:
- Must require knowledge FROM the listening to answer well
- Must NOT be answerable by just recalling what the speakers said
- Must place content into a context the listening never mentioned
- Keep to 1-2 sentences maximum
- Include Arabic translation

## Output Format

Return a SINGLE JSON object with ONLY these fields. No markdown fences, no explanation — ONLY valid JSON.

{
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
      "definition": "Clear English definition for ${dialogue.difficulty} learners",
      "definitionArabic": "كلمة عربية",
      "hintArabic": "شرح التعريف بالعربية",
      "explanation": "Why this word matters or how it's used",
      "explanationArabic": "شرح مختصر بالعربية",
      "example": "Example sentence using the word",
      "partOfSpeech": "noun/verb/adjective/adverb/phrase"
    }
  ],
  "preview": [
    {
      "type": "prediction",
      "items": [
        {
          "question": "Personal question about the topic",
          "questionArabic": "سؤال شخصي بالعربية",
          "options": ["Short answer 1", "Short answer 2", "Short answer 3"]
        }
      ]
    },
    {
      "type": "wordAssociation",
      "items": [
        { "word": "word from dialogue", "inDialogue": true },
        { "word": "distractor word", "inDialogue": false }
      ]
    }
  ],
  "classroomActivity": {
    "situationSetup": { "en": "English situation description", "ar": "وصف الموقف بالعربية" },
    "discussionPrompt": { "en": "English discussion prompt", "ar": "سؤال النقاش بالعربية" }
  },
  "transferQuestion": {
    "en": "English transfer question",
    "ar": "سؤال النقل بالعربية"
  }
}

Now generate the test content as a single JSON object:`;

  return { instructions, input };
}

// --- Component ---
export const OneShotCreator: React.FC<OneShotCreatorProps> = ({
  isOpen,
  defaultDifficulty,
  contentMode,
  defaultSpeakerCount = 'random' as const,
  onClose,
  onComplete,
}) => {
  const initialSpeakers = useMemo(() => resolveSpeakerDefault(defaultSpeakerCount), []);
  const [difficulty, setDifficulty] = useState<CEFRLevel>(defaultDifficulty);
  const [targetDuration, setTargetDuration] = useState(10); // Default 10 minutes
  const [speakerCount, setSpeakerCount] = useState<SpeakerCount>(initialSpeakers);
  const [audioFormat, setAudioFormat] = useState<AudioFormat | null>(() => getRandomFormat(initialSpeakers));
  const [currentTopic, setCurrentTopic] = useState(() =>
    getRandomTopic(initialSpeakers)
  );
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Pending data for audio fallback
  const [pendingPayload, setPendingPayload] = useState<OneShotPayload | null>(null);
  const [pendingSpeakerMapping, setPendingSpeakerMapping] = useState<SpeakerVoiceMapping>({});
  const [pendingAnalysis, setPendingAnalysis] = useState<{ speakers: string[] } | null>(null);
  const [audioFailReason, setAudioFailReason] = useState<string>('');

  const shuffleTopic = () => {
    setCurrentTopic(getRandomTopic(speakerCount, currentTopic));
    setIsCustomTopic(false);
  };

  const handleSpeakerCountChange = (count: SpeakerCount) => {
    setSpeakerCount(count);
    setCurrentTopic(getRandomTopic(count));
    setAudioFormat(getRandomFormat(count));
    setIsCustomTopic(false);
  };

  const effectiveTopic = isCustomTopic ? customTopic : currentTopic;

  const handleCopyTemplate = useCallback(async () => {
    const template = buildTemplate(difficulty, contentMode, targetDuration, effectiveTopic, speakerCount, audioFormat || undefined);
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
  }, [difficulty, contentMode, targetDuration, effectiveTopic, speakerCount, audioFormat]);

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

    // Store pending data for fallback
    setPendingPayload(payload);
    setPendingSpeakerMapping(speakerMapping);
    setPendingAnalysis(analysis);

    try {
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        throw new Error('Gemini API key not configured');
      }

      const { GoogleGenAI, Modality } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      // Build multi-speaker config
      const speakers = Object.entries(speakerMapping);
      const speechConfig = speakers.length >= 2
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
      if (!audioData) {
        throw new Error('No audio data returned from Gemini');
      }

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
    } catch (err) {
      console.error('[OneShot] Gemini TTS failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Gemini TTS failed';

      // Check if it's a quota/rate limit error
      const isQuotaError = errorMessage.toLowerCase().includes('quota') ||
                          errorMessage.toLowerCase().includes('rate') ||
                          errorMessage.toLowerCase().includes('limit') ||
                          errorMessage.includes('429') ||
                          errorMessage.includes('503');

      setAudioFailReason(isQuotaError ? 'Gemini quota exceeded' : errorMessage);
      setStage('audio_failed');
      return; // Exit and wait for user to choose fallback
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
        difficulty: payload.difficulty,
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
        preview: payload.preview && payload.preview.length > 0
          ? payload.preview.map(activity => ({
              type: activity.type,
              items: activity.items.map((item: any) => ({
                ...item,
                id: generateId(),
              })),
            }))
          : undefined,
        classroomActivity: payload.classroomActivity || undefined,
        transferQuestion: payload.transferQuestion || undefined,
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

  // Generate audio with OpenAI TTS (fallback)
  const generateOpenAIAudio = async (transcript: string): Promise<Blob> => {
    const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      throw new Error('OpenAI API key not configured');
    }

    // Strip speaker labels for single-voice narration
    const cleanTranscript = transcript
      .split('\n')
      .map(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0 && colonIndex < 30) {
          return line.substring(colonIndex + 1).trim();
        }
        return line;
      })
      .filter(line => line.trim())
      .join(' ');

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: cleanTranscript,
        voice: 'alloy',
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI TTS error: ${response.status}`);
    }

    return response.blob();
  };

  // Continue with save after getting audio (shared by Gemini and fallbacks)
  const continueWithAudio = async (audioBlob: Blob | null) => {
    if (!pendingPayload || !pendingAnalysis) return;

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
          title: pendingPayload.title,
          transcript: pendingPayload.transcript,
          audio_data: audioData,
          engine: audioBlob ? EngineType.GEMINI : EngineType.BROWSER,
          speaker_mapping: pendingSpeakerMapping,
          speakers: pendingAnalysis.speakers,
          is_transcript_only: !audioBlob,
          difficulty: pendingPayload.difficulty,
        }),
      });

      if (!response.ok) throw new Error('Failed to save audio');
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
      setErrorMsg(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStage('error');
      return;
    }

    // Create test
    setStage('creating-test');
    try {
      const testData = {
        audioId: audioEntry.id,
        title: pendingPayload.title,
        type: 'listening-comprehension',
        difficulty: pendingPayload.difficulty,
        questions: pendingPayload.questions.map(q => ({
          ...q,
          id: generateId(),
        })),
        lexis: pendingPayload.lexis.length > 0
          ? pendingPayload.lexis.map(l => ({
              ...l,
              id: generateId(),
            }))
          : undefined,
        preview: pendingPayload.preview && pendingPayload.preview.length > 0
          ? pendingPayload.preview.map(activity => ({
              type: activity.type,
              items: activity.items.map((item: any) => ({
                ...item,
                id: generateId(),
              })),
            }))
          : undefined,
        classroomActivity: pendingPayload.classroomActivity || undefined,
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
    }
  };

  // Handle OpenAI TTS fallback
  const handleOpenAIFallback = async () => {
    if (!pendingPayload) return;

    setStage('generating-audio');
    setErrorMsg('');

    try {
      const audioBlob = await generateOpenAIAudio(pendingPayload.transcript);
      await continueWithAudio(audioBlob);
    } catch (err) {
      console.error('[OneShot] OpenAI TTS also failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'OpenAI TTS failed';
      setAudioFailReason(`Both Gemini and OpenAI failed. Last error: ${errorMessage}`);
      setStage('audio_failed');
    }
  };

  // Handle transcript-only fallback
  const handleTranscriptOnlyFallback = async () => {
    await continueWithAudio(null);
  };

  if (!isOpen) return null;

  const isProcessing = stage !== 'idle' && stage !== 'error' && stage !== 'done' && stage !== 'audio_failed';
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
                <div className="mb-4">
                  <label className="text-sm text-slate-600 mb-2 block">
                    Duration: <span className="font-bold text-rose-600">{targetDuration} min</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="5"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>5 min</span>
                    <span>15 min</span>
                    <span>30 min</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    AI determines question/vocab counts based on duration + {difficulty} level
                  </p>
                </div>
                <div className="mb-3">
                  <label className="text-sm text-slate-600 mb-2 block">Speakers:</label>
                  <div className="flex items-center gap-2 mb-3">
                    {([1, 2, 3] as SpeakerCount[]).map((count) => (
                      <button
                        key={count}
                        onClick={() => handleSpeakerCountChange(count)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          speakerCount === count
                            ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {count === 3 ? '3+' : count}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const count = randomSpeakerCount();
                        setSpeakerCount(count);
                        setCurrentTopic(getRandomTopic(count));
                        setAudioFormat(getRandomFormat(count));
                        setIsCustomTopic(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-all"
                      title="Random speaker count"
                    >
                      🎲
                    </button>
                    {audioFormat && (
                      <>
                        <button
                          onClick={() => setAudioFormat(shuffleFormat(speakerCount, audioFormat.id))}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs text-slate-500 transition-colors flex-shrink-0 ml-2"
                        >
                          🔀
                        </button>
                        <span className="text-xs text-slate-400 truncate">{audioFormat.label}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-sm text-slate-600 mb-2 block">Topic:</label>
                  <div className="flex items-center gap-2">
                    {isCustomTopic ? (
                      <input
                        type="text"
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder="Type a custom topic..."
                        className="flex-1 px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700 truncate">
                        {currentTopic}
                      </div>
                    )}
                    <button
                      onClick={() => { shuffleTopic(); setIsCustomTopic(false); }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                    >
                      🎲
                    </button>
                    <button
                      onClick={() => setIsCustomTopic(!isCustomTopic)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        isCustomTopic ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      ✏️
                    </button>
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

          {/* Audio generation failed - show fallback options */}
          {stage === 'audio_failed' && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <div className="text-5xl mb-4">&#128266;</div>
                <h3 className="text-lg font-bold text-amber-700">Audio Generation Failed</h3>
                <p className="text-sm text-amber-600 mt-2 max-w-md mx-auto">{audioFailReason}</p>
              </div>

              <div className="space-y-3">
                {/* OpenAI TTS fallback button - show if Gemini failed but we haven't tried OpenAI yet */}
                {!audioFailReason.includes('OpenAI') && (
                  <button
                    onClick={handleOpenAIFallback}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-base hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-[0.98]"
                  >
                    &#127908; Try OpenAI TTS Instead
                  </button>
                )}

                {/* Transcript-only option - last resort */}
                <button
                  onClick={handleTranscriptOnlyFallback}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-base hover:from-amber-400 hover:to-orange-400 transition-all active:scale-[0.98]"
                >
                  &#128196; Save With Transcript Only
                </button>
                <p className="text-xs text-slate-500 text-center">
                  The test will be created without audio. Students will see the transcript.
                </p>

                {/* Cancel button */}
                <button
                  onClick={() => {
                    setStage('idle');
                    setPendingPayload(null);
                    setPendingSpeakerMapping({});
                    setPendingAnalysis(null);
                    setAudioFailReason('');
                  }}
                  className="w-full py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-colors"
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
