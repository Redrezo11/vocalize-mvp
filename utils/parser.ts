import { DialogueAnalysis, SpeakerSegment, SpeakerVoiceMapping, OPENAI_VOICES, GEMINI_VOICES } from '../types';
import { callOpenAI } from '../helpers/bonusGeneration';

const MALE_NAMES = new Set([
  'john', 'james', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles', 
  'christopher', 'daniel', 'matthew', 'anthony', 'donald', 'mark', 'paul', 'steven', 'andrew', 'kenneth', 
  'joshua', 'george', 'kevin', 'brian', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 
  'jacob', 'gary', 'nicholas', 'eric', 'stephen', 'jonathan', 'larry', 'justin', 'scott', 'brandon', 
  'benjamin', 'samuel', 'frank', 'gregory', 'raymond', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',
  'adam', 'harry', 'tyler', 'aaron', 'jose', 'henry', 'douglas', 'peter', 'zachary', 'nathan', 'walter',
  'kyle', 'harold', 'carl', 'jeremy', 'keith', 'roger', 'gerald', 'ethan', 'arthur', 'terry', 'christian', 
  'sean', 'lawrence', 'austin', 'joe', 'noah', 'jesse', 'albert', 'billy', 'bruce', 'willie', 'jordan', 
  'dylan', 'alan', 'ralph', 'gabriel', 'roy', 'juan', 'wayne', 'eugene', 'logan', 'randy', 'louis', 
  'russell', 'vincent', 'philip', 'bobby', 'johnny', 'bradley', 'mike', 'matt', 'chris', 'alex', 'sam', 
  'tom', 'dave', 'steve', 'jim', 'dan', 'tim', 'bob', 'bill', 'ron', 'jeff', 'greg', 'ken', 'puck', 'charon', 'fenrir'
]);

const FEMALE_NAMES = new Set([
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen', 
  'nancy', 'lisa', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle', 
  'dorothy', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia', 
  'kathleen', 'amy', 'shirley', 'angela', 'helen', 'anna', 'brenda', 'pamela', 'nicole', 'samantha', 
  'katherine', 'emma', 'ruth', 'christine', 'catherine', 'debra', 'rachel', 'carolyn', 'janet', 'virginia', 
  'maria', 'heather', 'diane', 'julie', 'joyce', 'victoria', 'olivia', 'kelly', 'christina', 'lauren', 
  'joan', 'evelyn', 'judith', 'megan', 'cheryl', 'andrea', 'hannah', 'martha', 'jacqueline', 'frances', 
  'gloria', 'ann', 'teresa', 'kathryn', 'sara', 'janice', 'jean', 'alice', 'madison', 'julia', 'grace', 
  'judy', 'abigail', 'marie', 'denise', 'beverly', 'amber', 'theresa', 'marilyn', 'danielle', 'diana', 
  'brittany', 'natalie', 'sophia', 'rose', 'kayla', 'alexis', 'jane', 'liz', 'deb', 'cathy', 'katie', 
  'beth', 'jen', 'kore', 'zephyr', 'mom', 'mother', 'grandma', 'aunt', 'sister', 'queen', 'lady', 'madam'
]);

export const guessGender = (name: string): 'Male' | 'Female' | 'Neutral' => {
  const n = name.toLowerCase().trim();
  const firstName = n.split(/\s+/)[0].replace(/[^a-z]/g, ''); // Extract first word, remove punctuation
  
  // Explicit Titles/Honorifics (Regex for safety)
  if (/\b(mr|mr\.|sir|king|lord|father|dad|grandpa|brother|uncle|boy|male|guy|man)\b/.test(n)) return 'Male';
  if (/\b(mrs|mrs\.|ms|ms\.|miss|lady|queen|mother|mom|grandma|sister|aunt|girl|female|woman|madam)\b/.test(n)) return 'Female';

  // Strict Name Matching (First Name)
  if (FEMALE_NAMES.has(firstName)) return 'Female';
  if (MALE_NAMES.has(firstName)) return 'Male';

  return 'Neutral';
};

// Parse LLM-formatted transcript with TITLE, VOICE_ASSIGNMENTS, and DIALOGUE sections
export interface ParsedTranscript {
  title: string | null;
  voiceAssignments: { [speaker: string]: string };
  dialogueText: string;
  hasLLMFormat: boolean;
}

export const parseLLMTranscript = (text: string): ParsedTranscript => {
  const result: ParsedTranscript = {
    title: null,
    voiceAssignments: {},
    dialogueText: text,
    hasLLMFormat: false,
  };

  // Check for LLM format markers
  const hasTitle = /^TITLE:/mi.test(text);
  const hasVoiceAssignments = /^VOICE_ASSIGNMENTS:/mi.test(text);
  const hasDialogue = /^DIALOGUE:/mi.test(text);

  // If it doesn't have the LLM format, return original text
  if (!hasDialogue && !hasVoiceAssignments) {
    return result;
  }

  result.hasLLMFormat = true;

  // Extract title
  const titleMatch = text.match(/^TITLE:\s*(.+)$/mi);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  }

  // Extract voice assignments section
  if (hasVoiceAssignments) {
    // Find the voice assignments section (between VOICE_ASSIGNMENTS: and DIALOGUE:)
    // Use a simpler approach: find the section boundaries and extract text between them
    const lines = text.split('\n');
    let inVoiceSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for section headers
      if (/^VOICE_ASSIGNMENTS:/i.test(trimmed)) {
        inVoiceSection = true;
        continue;
      }
      if (/^DIALOGUE:/i.test(trimmed)) {
        inVoiceSection = false;
        break;
      }
      if (/^TITLE:/i.test(trimmed)) {
        continue;
      }

      // If we're in the voice section, try to parse assignment
      if (inVoiceSection && trimmed) {
        const match = trimmed.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          const speaker = match[1].trim();
          const voice = match[2].trim();
          // Skip if it looks like a section header
          if (!['TITLE', 'VOICE_ASSIGNMENTS', 'DIALOGUE'].includes(speaker.toUpperCase())) {
            result.voiceAssignments[speaker] = voice;

            // Also extract name from parentheses if present: "Customer (Faisal)" -> also map "Faisal"
            const parenMatch = speaker.match(/\(([^)]+)\)/);
            if (parenMatch) {
              const nameInParens = parenMatch[1].trim();
              result.voiceAssignments[nameInParens] = voice;
            }

            // Also extract first word as potential name: "Customer Faisal" -> also map "Faisal" won't work
            // But "Faisal the Customer" -> map "Faisal"
            const words = speaker.split(/\s+/);
            if (words.length > 1) {
              // Map the first word (often the name)
              result.voiceAssignments[words[0]] = voice;
            }
          }
        }
      }
    }
  }

  // Extract dialogue section
  if (hasDialogue) {
    const dialogueMatch = text.match(/^DIALOGUE:\s*\n([\s\S]*)$/mi);
    if (dialogueMatch) {
      result.dialogueText = dialogueMatch[1].trim();
    }
  }

  return result;
};

export const parseDialogue = (text: string): DialogueAnalysis => {
  // First check if it's LLM format and extract just the dialogue part
  const llmParsed = parseLLMTranscript(text);
  const textToParse = llmParsed.hasLLMFormat ? llmParsed.dialogueText : text;

  const lines = textToParse.split('\n');
  const segments: SpeakerSegment[] = [];
  const speakers = new Set<string>();

  // Regex to look for "Name: Message" pattern
  // Matches "John:", "Speaker 1:", "MR. SMITH:"
  const dialogueRegex = /^([A-Za-z0-9\s_.-]+):\s+(.*)/;

  let currentSpeaker = 'Narrator';
  let hasDialogueFormat = false;

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const match = trimmedLine.match(dialogueRegex);

    if (match) {
      hasDialogueFormat = true;
      const detectedSpeaker = match[1].trim();
      const content = match[2].trim();

      currentSpeaker = detectedSpeaker;
      speakers.add(detectedSpeaker);

      if (content) {
        segments.push({ speaker: detectedSpeaker, text: content });
      }
    } else {
      // Continuation of previous speaker or general narration
      // If we haven't found any dialogue tags yet, assume it's narration
      if (segments.length === 0 && !hasDialogueFormat) {
        speakers.add('Narrator');
      }

      segments.push({ speaker: currentSpeaker, text: trimmedLine });
    }
  });

  const uniqueSpeakers = Array.from(speakers);

  return {
    isDialogue: uniqueSpeakers.length > 1 || (uniqueSpeakers.length === 1 && uniqueSpeakers[0] !== 'Narrator'),
    speakers: uniqueSpeakers,
    segments
  };
};

// Style-matched Gemini → OpenAI voice mapping (from VOICE_ASSIGNMENT_GUIDE.md)
const GEMINI_TO_OPENAI: Record<string, string> = {
  // Female: Gemini voice → OpenAI voice (style-matched)
  Aoede: 'coral', Kore: 'sage', Leda: 'nova', Zephyr: 'nova',
  Autonoe: 'coral', Callirhoe: 'shimmer', Despina: 'sage', Erinome: 'sage',
  Gacrux: 'ballad', Laomedeia: 'shimmer', Pulcherrima: 'ballad',
  Sulafat: 'shimmer', Vindemiatrix: 'sage', Achernar: 'shimmer',
  // Male: Gemini voice → OpenAI voice (style-matched)
  Puck: 'verse', Charon: 'ash', Fenrir: 'echo', Orus: 'onyx',
  Achird: 'fable', Algenib: 'onyx', Algieba: 'fable', Alnilam: 'onyx',
  Enceladus: 'echo', Iapetus: 'echo', Rasalgethi: 'verse',
  Sadachbia: 'ash', Sadaltager: 'ash', Schedar: 'ash',
  Umbriel: 'fable', Zubenelgenubi: 'fable',
};

/**
 * Map Gemini voice assignments to style-matched OpenAI voices.
 * Preserves gender and matches tone/style. Avoids duplicate assignments.
 */
export function mapGeminiToOpenAIVoices(
  geminiMapping: SpeakerVoiceMapping
): SpeakerVoiceMapping {
  const result: SpeakerVoiceMapping = {};
  const usedVoices = new Set<string>();

  for (const [speaker, geminiVoice] of Object.entries(geminiMapping)) {
    let openaiVoice = GEMINI_TO_OPENAI[geminiVoice];

    // If mapped voice already used by another speaker, find alternative of same gender
    if (openaiVoice && usedVoices.has(openaiVoice)) {
      const geminiDef = GEMINI_VOICES.find(v => v.name === geminiVoice);
      const gender = geminiDef?.gender || 'Male';
      const candidates = OPENAI_VOICES.filter(v => v.gender === gender && !usedVoices.has(v.name));
      openaiVoice = candidates[0]?.name || openaiVoice; // allow duplicate if exhausted
    }

    // Gender-aware fallback if voice not in mapping
    if (!openaiVoice) {
      const geminiDef = GEMINI_VOICES.find(v => v.name === geminiVoice);
      openaiVoice = geminiDef?.gender === 'Female' ? 'nova' : 'alloy';
    }

    result[speaker] = openaiVoice;
    usedVoices.add(openaiVoice);
  }
  return result;
}

export function assignOpenAIVoices(speakers: string[]): SpeakerVoiceMapping {
  const femaleVoices = OPENAI_VOICES.filter(v => v.gender === 'Female');
  const maleVoices = OPENAI_VOICES.filter(v => v.gender === 'Male');
  let femaleIdx = 0;
  let maleIdx = 0;

  const mapping: SpeakerVoiceMapping = {};
  for (const speaker of speakers) {
    const gender = guessGender(speaker);
    if (gender === 'Female') {
      mapping[speaker] = femaleVoices[femaleIdx % femaleVoices.length].name;
      femaleIdx++;
    } else if (gender === 'Male') {
      mapping[speaker] = maleVoices[maleIdx % maleVoices.length].name;
      maleIdx++;
    } else {
      // Neutral — alternate male/female for variety
      if (maleIdx <= femaleIdx) {
        mapping[speaker] = maleVoices[maleIdx % maleVoices.length].name;
        maleIdx++;
      } else {
        mapping[speaker] = femaleVoices[femaleIdx % femaleVoices.length].name;
        femaleIdx++;
      }
    }
  }
  return mapping;
}

/**
 * Resolve gender for a name — uses name lists first, falls back to LLM for unknowns.
 * Always returns Male or Female (never Neutral).
 */
export async function resolveGender(name: string): Promise<'Male' | 'Female'> {
  const quick = guessGender(name);
  if (quick !== 'Neutral') return quick;

  try {
    const response = await callOpenAI(
      'gpt-4o-mini',
      'Given a character name, respond with exactly one word: Male or Female.',
      name
    );
    return response.trim() === 'Female' ? 'Female' : 'Male';
  } catch {
    return 'Male'; // safe fallback on API error
  }
}

/**
 * Async version of assignOpenAIVoices — resolves unknown genders via LLM.
 * Use when no prior Gemini mapping is available.
 */
export async function assignOpenAIVoicesAsync(
  speakers: string[]
): Promise<SpeakerVoiceMapping> {
  const femaleVoices = OPENAI_VOICES.filter(v => v.gender === 'Female');
  const maleVoices = OPENAI_VOICES.filter(v => v.gender === 'Male');
  let femaleIdx = 0;
  let maleIdx = 0;

  const genders = await Promise.all(speakers.map(s => resolveGender(s)));

  const mapping: SpeakerVoiceMapping = {};
  for (let i = 0; i < speakers.length; i++) {
    if (genders[i] === 'Female') {
      mapping[speakers[i]] = femaleVoices[femaleIdx % femaleVoices.length].name;
      femaleIdx++;
    } else {
      mapping[speakers[i]] = maleVoices[maleIdx % maleVoices.length].name;
      maleIdx++;
    }
  }
  return mapping;
}