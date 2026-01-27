import React, { useState, useMemo } from 'react';
import { EngineType, ElevenLabsVoice } from '../types';
import { ClipboardIcon, CheckCircleIcon, SparklesIcon, XIcon } from './Icons';

type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

interface PromptBuilderProps {
  isOpen: boolean;
  engine: EngineType;
  elevenLabsVoices?: ElevenLabsVoice[]; // Actual voices from ElevenLabs API
  defaultDifficulty?: CEFRLevel; // Default difficulty from app settings
  onClose: () => void;
  onApplyPrompt: (prompt: string, voiceAssignments: Record<string, string>) => void;
}

const CEFR_DESCRIPTIONS: Record<CEFRLevel, string> = {
  'A1': 'Beginner - Basic phrases, simple present tense, very common vocabulary',
  'A2': 'Elementary - Simple sentences, past tense, everyday topics',
  'B1': 'Intermediate - Connected speech, opinions, familiar topics',
  'B2': 'Upper-Intermediate - Complex ideas, abstract topics, natural speech',
  'C1': 'Advanced - Nuanced language, idiomatic expressions, sophisticated topics',
};

const EFL_TOPICS = [
  // Daily Life
  'Ordering food at a restaurant',
  'Making a doctor\'s appointment',
  'Shopping for groceries',
  'Asking for directions',
  'Checking into a hotel',
  'Making travel plans',
  'Discussing weekend plans',
  'Talking about hobbies',
  'Describing your daily routine',
  'Meeting new neighbors',
  // Work & School
  'Job interview preparation',
  'Discussing a group project',
  'Asking a teacher for help',
  'Planning a business meeting',
  'Giving a presentation',
  'Discussing career goals',
  // Social
  'Making small talk at a party',
  'Inviting someone to an event',
  'Apologizing for a mistake',
  'Giving and receiving compliments',
  'Discussing a movie or book',
  'Planning a birthday party',
  // Practical
  'Returning an item to a store',
  'Calling customer service',
  'Booking a flight',
  'Renting an apartment',
  'Opening a bank account',
  'Reporting a problem to maintenance',
  // Cultural
  'Discussing cultural differences',
  'Explaining a holiday tradition',
  'Talking about local customs',
  'Describing your hometown',
  'Discussing environmental issues',
  'Talking about technology',
];

const DURATION_PRESETS = [
  { label: '30 seconds', value: 30, words: '60-80' },
  { label: '1 minute', value: 60, words: '120-150' },
  { label: '1:30 (Recommended)', value: 90, words: '180-220' },
  { label: '2 minutes', value: 120, words: '240-300' },
  { label: '3 minutes', value: 180, words: '360-450' },
];

// Gemini voice reference for prompt
const GEMINI_VOICES_PROMPT = `
### Gemini TTS Voices - Detailed Personality Profiles

**FEMALE VOICES (14):**

| Voice | Style | Personality | Best For | Sounds Like |
|-------|-------|-------------|----------|-------------|
| **Aoede** | Breezy | Relaxed, approachable, like chatting with a friend over coffee | Casual dialogues, friendly conversations, lifestyle content | A laid-back millennial sharing stories |
| **Kore** | Firm | Confident, no-nonsense, commands attention without being harsh | Teachers, managers, instructions, authority figures | A respected professor who students actually like |
| **Leda** | Youthful | Bright-eyed, curious, full of wonder and enthusiasm | Young students, teenagers, excited learners | A college freshman on their first day |
| **Zephyr** | Bright | Optimistic, uplifting, radiates positive energy | Cheerful characters, good news, motivational content | A morning show host who's genuinely happy |
| **Autonoe** | Warm | Nurturing, empathetic, makes you feel safe and understood | Mothers, counselors, supportive characters | A caring aunt giving life advice |
| **Callirhoe** | Gentle | Soft-spoken, patient, never rushes | Children's content, bedtime stories, sensitive topics | A kindergarten teacher at story time |
| **Despina** | Smooth | Polished, sophisticated, effortlessly professional | Business settings, corporate narration, luxury brands | A senior executive at a Fortune 500 company |
| **Erinome** | Clear | Articulate, precise, explains complex things simply | Educational content, tutorials, how-to guides | A science communicator on YouTube |
| **Gacrux** | Mature | Wise, experienced, speaks with earned authority | Mentors, grandmothers, sage advisors | A retired professor sharing life lessons |
| **Laomedeia** | Calm | Peaceful, grounding, slows your heartbeat | Meditation, relaxation, mindfulness | A yoga instructor during savasana |
| **Pulcherrima** | Elegant | Refined, cultured, exudes sophistication | Formal events, luxury, high-end narration | A museum curator at a gala opening |
| **Sulafat** | Serene | Tranquil, ethereal, almost dreamlike quality | Wellness content, nature documentaries, ambient | A spa receptionist welcoming guests |
| **Vindemiatrix** | Refined | Intellectual, literary, appreciates nuance | Audiobooks, poetry, academic discussions | A literature professor discussing classics |
| **Achernar** | Soft | Intimate, personal, like sharing a secret | Personal stories, ASMR-adjacent, whispered confessions | A close friend having a heart-to-heart |

**MALE VOICES (16):**

| Voice | Style | Personality | Best For | Sounds Like |
|-------|-------|-------------|----------|-------------|
| **Puck** | Upbeat | Energetic, playful, can't contain his excitement | Young characters, fun content, enthusiastic students | A kid on Christmas morning |
| **Charon** | Informative | Knowledgeable but accessible, makes learning fun | Educational narration, documentaries, explainers | David Attenborough's friendly nephew |
| **Fenrir** | Excitable | High-energy, action-ready, lives for adventure | Action scenes, sports, exciting announcements | A sports commentator during the finals |
| **Orus** | Firm | Commanding, decisive, born leader | Authority figures, bosses, military characters | A general addressing troops |
| **Achird** | Friendly | Warm, helpful, genuinely wants to assist | Customer service, helpful guides, supportive friends | Your favorite IT guy who actually explains things |
| **Algenib** | Gravelly | Rough around the edges, seen some things | Tough characters, villains, weathered narrators | A detective in a noir film |
| **Algieba** | Smooth | Polished, confident, corporate charm | Business professionals, salespeople, executives | A successful startup founder pitching |
| **Alnilam** | Firm | Formal, structured, by-the-book | Official announcements, legal, government | A news anchor reading serious news |
| **Enceladus** | Breathy | Dramatic, intimate, draws you in | Storytelling, romance, emotional moments | An actor performing a dramatic monologue |
| **Iapetus** | Deep | Powerful bass, resonant, fills the room | Announcements, trailers, epic narration | A movie trailer voice-over artist |
| **Rasalgethi** | Lively | Dynamic, entertaining, keeps energy high | Show hosts, entertainers, MCs | A late-night talk show host |
| **Sadachbia** | Clear | Precise, articulate, crystal clear diction | Instructions, tutorials, technical content | A pilot making cabin announcements |
| **Sadaltager** | Knowledgeable | Expert, academic, deeply informed | Lectures, expert commentary, scholarly content | A TED talk speaker in their field |
| **Schedar** | Professional | Business-ready, trustworthy, competent | Corporate content, presentations, B2B | A management consultant presenting findings |
| **Umbriel** | Relaxed | Laid-back, chill, no pressure | Casual conversations, podcasts, friendly chats | A surfer dude who's surprisingly insightful |
| **Zubenelgenubi** | Casual | Everyday, conversational, totally natural | Slice-of-life, regular people, informal settings | Your neighbor chatting over the fence |

### Voice Pairing Guide for Dialogues:

\`\`\`
SCENARIO                          RECOMMENDED PAIRING (creates good contrast)
────────────────────────────────────────────────────────────────────────────
Teacher + Student                 Kore/Charon (patient authority) + Leda/Puck (curious energy)
Parent + Child                    Autonoe/Achird (warm) + Callirhoe/Puck (innocent)
Boss + Employee                   Orus/Despina (commanding) + Achird/Zephyr (eager to please)
Expert + Learner                  Sadaltager/Erinome (knowledgeable) + Leda/Puck (curious)
Friends chatting                  Aoede + Zephyr (F) or Umbriel + Zubenelgenubi (M)
Formal interview                  Schedar/Despina (interviewer) + Algieba/Pulcherrima (interviewee)
Customer service                  Achird/Autonoe (helpful) + Zubenelgenubi/Aoede (customer)
News anchor + Field reporter      Alnilam/Despina (anchor) + Fenrir/Zephyr (reporter)
Storyteller + Characters          Vindemiatrix/Enceladus (narrator) + varied character voices
\`\`\`
`;

const ELEVENLABS_FREE_VOICES_PROMPT = `
### ElevenLabs FREE Tier - Detailed Voice Profiles (USE ONLY THESE 21 VOICES)

**FEMALE VOICES (8):**

| Voice | Accent | Personality | Best For | Sounds Like |
|-------|--------|-------------|----------|-------------|
| **Rachel** | American | Calm, composed, trustworthy, the "default good narrator" | General narration, audiobooks, educational content | A NPR podcast host - pleasant and professional |
| **Domi** | American | Strong, confident, powerful presence, commands attention | Motivational content, strong female characters, leadership | A female CEO giving a keynote speech |
| **Sarah** | American | Soft, gentle, warm but professional | News reading, gentle explanations, soft narration | A morning news anchor with a kind demeanor |
| **Emily** | American | Peaceful, soothing, almost hypnotic calmness | Meditation, relaxation, sleep stories, ASMR-adjacent | A meditation app guide |
| **Dorothy** | British | Pleasant, proper, charming British warmth | Children's stories, British characters, gentle narration | Mary Poppins reading bedtime stories |
| **Freya** | American | Neutral, adaptable, everywoman quality | Versatile use, everywoman characters, relatable roles | Your smart, capable coworker |
| **Gigi** | American | Childlike, animated, full of wonder | Children, young characters, animation, playful content | A Disney animated character |
| **Charlotte** | Swedish | Alluring, mysterious, European sophistication | Femme fatale, mysterious characters, European settings | A Bond girl with secrets |

**MALE VOICES (13):**

| Voice | Accent | Personality | Best For | Sounds Like |
|-------|--------|-------------|----------|-------------|
| **Adam** | American | Deep, authoritative, commanding presence | Narration, documentaries, authority figures | Morgan Freeman's younger brother |
| **Antoni** | American | Balanced, versatile, reliable everyman | General purpose, friendly characters, tutorials | A friendly YouTuber explaining things |
| **Arnold** | American | Crisp, clear, professional precision | Corporate content, instructions, professional settings | A polished business presenter |
| **Josh** | American | Deep but young, confident without arrogance | Young professionals, confident students, modern narration | A successful 30-something entrepreneur |
| **Sam** | American | Raspy, edgy, lived-in quality | Edgy content, rock stars, rebels, intense characters | A rock musician being interviewed |
| **Thomas** | American | Calm, measured, peaceful presence | Meditation, relaxation, thoughtful characters | A mindfulness teacher |
| **Clyde** | American | Gruff, military, seen-things veteran | Military characters, tough guys, action heroes | A retired sergeant telling war stories |
| **Dave** | British-Essex | Casual, gaming culture, laddish charm | Gaming content, casual British, young British men | A British gaming YouTuber |
| **Fin** | Irish | Weathered, storytelling quality, old soul | Irish characters, sailors, storytellers, wise elders | An old fisherman in an Irish pub |
| **Harry** | American | Nervous, uncertain, endearingly awkward | Anxious characters, comedy, relatable nervousness | A guy on his first date, trying too hard |
| **Daniel** | British | Deep, authoritative British gravitas | News, formal British, authority figures | A BBC news presenter |
| **George** | British | Raspy, dramatic, theatrical quality | Villains, dramatic narration, intense British characters | A Shakespearean actor doing voice work |
| **Callum** | American | Hoarse, rugged, blue-collar authenticity | Working-class characters, tough guys, gritty realism | A construction foreman |

### Voice Pairing Guide for Dialogues (FREE TIER):

\`\`\`
SCENARIO                          RECOMMENDED PAIRING (creates contrast)
────────────────────────────────────────────────────────────────────────────
Teacher + Student                 Rachel/Antoni (patient) + Gigi (curious child)
                                  or Arnold (precise) + Josh (eager young adult)
Parent + Child                    Sarah/Adam (warm authority) + Gigi (innocent)
Boss + Employee                   Daniel/Domi (commanding) + Antoni/Freya (respectful)
Expert + Learner                  Adam/Rachel (knowledgeable) + Josh/Freya (curious)
Friends chatting                  Freya + Dorothy (F) or Antoni + Dave (M)
Customer service                  Antoni/Rachel (helpful) + Freya/Josh (customer)
News anchor + Field reporter      Daniel/Sarah (anchor) + Dave/Freya (reporter)
Storyteller + Characters          Adam/Dorothy (narrator) + varied character voices
Serious + Comic relief            Daniel/Domi (serious) + Harry/Dave (funny)
British setting                   Daniel + Dorothy + George + Dave (mix for variety)
\`\`\`
`;

const ELEVENLABS_PAID_VOICES_PROMPT = `

### ElevenLabs PAID Tier - Additional Voice Profiles (22 more voices)
[All FREE tier voices above PLUS these:]

**ADDITIONAL FEMALE (8):**

| Voice | Accent | Personality | Best For | Sounds Like |
|-------|--------|-------------|----------|-------------|
| **Alice** | British | Confident, professional British authority | News, corporate British, female executives | A BBC correspondent |
| **Glinda** | American | Theatrical, witchy, magical quality | Fantasy characters, witches, mystical narration | The good witch in a fairy tale |
| **Grace** | Southern US | Warm, hospitable, genuine Southern charm | Southern characters, friendly narration, hospitality | A Southern hostess welcoming guests |
| **Lily** | British | Raspy, dramatic, intense emotional range | Dramatic characters, villains, emotional scenes | A British actress in a thriller |
| **Matilda** | American | Warm, storytelling quality, engaging | Audiobooks, bedtime stories, warm narration | A beloved librarian reading aloud |
| **Mimi** | Swedish | Childlike, playful, innocent mischief | Young characters, playful content, animation | A mischievous fairy tale character |
| **Nicole** | American | Whispered, intimate, ASMR quality | ASMR, intimate moments, secrets, soft narration | An ASMR artist |
| **Serena** | American | Pleasant, conversational, naturally engaging | Interactive content, chatbots, friendly assistance | A helpful virtual assistant with personality |

**ADDITIONAL MALE (14):**

| Voice | Accent | Personality | Best For | Sounds Like |
|-------|--------|-------------|----------|-------------|
| **Bill** | American | Strong, trustworthy, documentary gravitas | Documentaries, serious narration, trustworthy figures | A documentary narrator you'd believe |
| **Brian** | American | Deep bass, powerful, room-filling presence | Trailers, announcements, epic content | A movie trailer voice |
| **Charlie** | Australian | Casual, laid-back, friendly Aussie | Australian characters, casual content, friendly guides | An Australian travel show host |
| **Chris** | American | Casual, friendly, relatable everyman | Casual content, friendly characters, tutorials | A friendly neighbor giving advice |
| **Drew** | American | Polished, versatile, news-ready | News, professional content, corporate | A network news anchor |
| **Ethan** | American | Soft, gentle, ASMR quality | ASMR, gentle content, soft-spoken characters | A soft-spoken poet |
| **Giovanni** | Italian | Accented English, charming foreigner | Italian/European characters, international settings | An Italian chef explaining recipes |
| **James** | Australian | Calm, mature, seasoned professional | Mature Australian, news, authoritative calm | An Australian news veteran |
| **Jeremy** | American-Irish | Excited, enthusiastic, boundless energy | Energetic content, excited characters, hype | An excited sports fan |
| **Jessie** | American | Aged, raspy, lived a full life | Elderly characters, wise old men, grizzled figures | A grandfather telling stories |
| **Joseph** | British | Formal, proper, establishment British | Formal British, upper class, professional | A British barrister |
| **Liam** | American | Neutral, adaptable, professional blank slate | Versatile use, adaptable characters | A professional voice actor |
| **Michael** | American | Wise, elder statesman, gravitas with warmth | Wise elders, mentors, grandfather figures | A retired judge sharing wisdom |
| **Patrick** | American | Loud, intense, drill-sergeant energy | Action, intense moments, commanders | A coach giving a halftime speech |
| **Paul** | American | Reporter cadence, field journalist | News reports, on-location narration | A field reporter in breaking news |

### PAID Tier Voice Pairing Expansions:

\`\`\`
SCENARIO                          PAID TIER ADDITIONS (more options)
────────────────────────────────────────────────────────────────────────────
Teacher + Student                 + Alice/Drew (polished) + Jeremy (eager)
Professional meeting              + Alice + Joseph + Bill + Drew (British/American mix)
Wise mentor + Young learner       + Michael/Jessie (wise) + Jeremy (eager)
Family drama                      + Grace/Matilda (warm) + Michael/Jessie (elders)
Australian setting                + Charlie + James (Australian variety)
Italian/European setting          + Giovanni (authentic accent)
Action/Intense scenes             + Patrick + Brian (high energy/powerful)
Intimate/Emotional                + Nicole/Ethan (soft) + Lily (dramatic)
Fantasy/Magical                   + Glinda + Mimi (mystical quality)
Children's animated               + Mimi + Gigi + Serena (playful variety)
\`\`\`
`;

export const PromptBuilder: React.FC<PromptBuilderProps> = ({
  isOpen,
  engine,
  elevenLabsVoices = [],
  defaultDifficulty = 'B1',
  onClose,
  onApplyPrompt,
}) => {
  const [difficulty, setDifficulty] = useState<CEFRLevel>(defaultDifficulty);
  const [topic, setTopic] = useState('');

  // Update difficulty when defaultDifficulty changes (from settings)
  React.useEffect(() => {
    setDifficulty(defaultDifficulty);
  }, [defaultDifficulty]);

  // Generate dynamic voice list from actual ElevenLabs voices
  const dynamicElevenLabsVoiceList = useMemo(() => {
    if (elevenLabsVoices.length === 0) return null;

    const femaleVoices = elevenLabsVoices.filter(v => v.labels?.gender === 'female');
    const maleVoices = elevenLabsVoices.filter(v => v.labels?.gender === 'male');
    const otherVoices = elevenLabsVoices.filter(v => !v.labels?.gender || (v.labels?.gender !== 'female' && v.labels?.gender !== 'male'));

    const formatVoice = (v: ElevenLabsVoice) => {
      const accent = v.labels?.accent || 'unknown';
      const description = v.labels?.description || v.labels?.use_case || '';
      return `${v.name} (${accent}${description ? ', ' + description : ''})`;
    };

    let list = `### Your ElevenLabs Voices (${elevenLabsVoices.length} available)\n\n`;

    if (femaleVoices.length > 0) {
      list += `**Female Voices (${femaleVoices.length}):**\n`;
      list += femaleVoices.map(formatVoice).join(', ') + '\n\n';
    }

    if (maleVoices.length > 0) {
      list += `**Male Voices (${maleVoices.length}):**\n`;
      list += maleVoices.map(formatVoice).join(', ') + '\n\n';
    }

    if (otherVoices.length > 0) {
      list += `**Other Voices (${otherVoices.length}):**\n`;
      list += otherVoices.map(formatVoice).join(', ') + '\n\n';
    }

    list += `**IMPORTANT:** Only use voice names from the list above. Use the exact voice name (e.g., "Sarah", "Adam", "Daniel") without any description text.\n`;

    return list;
  }, [elevenLabsVoices]);

  // Get example voice names from actual available voices
  const getVoiceExamples = useMemo(() => {
    if (elevenLabsVoices.length === 0) {
      // Fallback to static examples if no voices loaded
      return {
        femaleExamples: 'Sarah, Alice, Bella',
        maleExamples: 'Adam, Daniel, Brian',
        americanExamples: 'voices with American accent',
        britishExamples: 'voices with British accent'
      };
    }

    const females = elevenLabsVoices.filter(v => v.labels?.gender === 'female').slice(0, 3).map(v => v.name);
    const males = elevenLabsVoices.filter(v => v.labels?.gender === 'male').slice(0, 3).map(v => v.name);
    const american = elevenLabsVoices.filter(v => v.labels?.accent?.toLowerCase() === 'american').slice(0, 4).map(v => v.name);
    const british = elevenLabsVoices.filter(v => v.labels?.accent?.toLowerCase() === 'british').slice(0, 4).map(v => v.name);

    return {
      femaleExamples: females.length > 0 ? females.join(', ') : 'female voices from the list',
      maleExamples: males.length > 0 ? males.join(', ') : 'male voices from the list',
      americanExamples: american.length > 0 ? american.join(', ') : 'American accent voices',
      britishExamples: british.length > 0 ? british.join(', ') : 'British accent voices'
    };
  }, [elevenLabsVoices]);

  const [useRandomTopic, setUseRandomTopic] = useState(true);
  const [currentRandomTopic, setCurrentRandomTopic] = useState(() =>
    EFL_TOPICS[Math.floor(Math.random() * EFL_TOPICS.length)]
  );
  const [duration, setDuration] = useState(90);
  const [customDuration, setCustomDuration] = useState('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [elevenLabsTier, setElevenLabsTier] = useState<'free' | 'paid'>('free');
  const [accentPreference, setAccentPreference] = useState<'auto' | 'american' | 'british'>('auto');
  const [copied, setCopied] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  const getVoiceReference = () => {
    if (engine === EngineType.GEMINI) {
      return GEMINI_VOICES_PROMPT;
    } else if (engine === EngineType.ELEVEN_LABS) {
      // Use actual voices from API if available, otherwise fall back to static list
      if (dynamicElevenLabsVoiceList) {
        return dynamicElevenLabsVoiceList;
      }
      return elevenLabsTier === 'free'
        ? ELEVENLABS_FREE_VOICES_PROMPT
        : ELEVENLABS_FREE_VOICES_PROMPT + ELEVENLABS_PAID_VOICES_PROMPT;
    }
    return '';
  };

  const getWordCount = () => {
    const actualDuration = useCustomDuration ? parseInt(customDuration) || 90 : duration;
    const wordsPerSecond = 2.5; // Average speaking rate
    const targetWords = Math.round(actualDuration * wordsPerSecond);
    const minWords = Math.round(targetWords * 0.85);
    const maxWords = Math.round(targetWords * 1.15);
    return { min: minWords, max: maxWords, target: targetWords };
  };

  const generatePrompt = () => {
    const selectedTopic = useRandomTopic ? currentRandomTopic : topic;
    const actualDuration = useCustomDuration ? parseInt(customDuration) || 90 : duration;
    const wordCount = getWordCount();
    const engineName = engine === EngineType.GEMINI ? 'Gemini' : 'ElevenLabs';
    const tierNote = engine === EngineType.ELEVEN_LABS
      ? `\n**IMPORTANT: Use ${elevenLabsTier.toUpperCase()} tier voices ONLY.**`
      : '';

    const prompt = `# EFL Listening Exercise Generator

## Task
Create an engaging listening dialogue for English as a Foreign Language (EFL) learners.

## Requirements

### Difficulty Level: ${difficulty} (${CEFR_DESCRIPTIONS[difficulty]})

### Topic: ${selectedTopic}

### Duration: ~${Math.floor(actualDuration / 60)}:${(actualDuration % 60).toString().padStart(2, '0')} (${wordCount.min}-${wordCount.max} words)

### TTS Engine: ${engineName}${tierNote}

## Voice Selection Guidelines

1. **For educational content**: Use clear, articulate voices ${engine === EngineType.GEMINI ? '(Charon, Erinome for Gemini)' : `(e.g., ${getVoiceExamples.femaleExamples.split(', ')[0] || 'Sarah'}, ${getVoiceExamples.maleExamples.split(', ')[0] || 'Daniel'})`}
2. **For dialogues**: Use contrasting voices for different speakers (different genders, styles, or ages)
3. **For young characters**: Use youthful voices ${engine === EngineType.GEMINI ? '(Leda, Puck for Gemini)' : '(pick younger-sounding voices from the list)'}
4. **For authority figures**: Use firm/professional voices ${engine === EngineType.GEMINI ? '(Kore, Orus for Gemini)' : `(e.g., ${getVoiceExamples.maleExamples.split(', ')[0] || 'Daniel'}, ${getVoiceExamples.maleExamples.split(', ')[1] || 'Adam'})`}
${engine === EngineType.ELEVEN_LABS ? `
### ElevenLabs Accent Selection

${accentPreference === 'auto' ? `**Accent Preference: AUTO** - Use the decision tree below to select accents based on character/setting:

\`\`\`
CHARACTER/SETTING ANALYSIS
         │
         ▼
┌─────────────────────────────┐
│ Is nationality/region       │
│ important for this char?    │
└─────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
   YES        NO → Use American (default/neutral)
    │              ${getVoiceExamples.americanExamples}
    ▼
┌─────────────────────────────┐
│ What region/nationality?    │
└─────────────────────────────┘
    │
    ├─► UK/British → ${getVoiceExamples.britishExamples || 'British accent voices'}
    ├─► Other accents → Check voice list for matching accents
    └─► Default → American voices
\`\`\`

**Key Decision Points:**
- British setting (UK, London, etc.) → Use British-accented voices from the list
- No specific nationality → Default to American
- Check the voice list above for available accents` : accentPreference === 'american' ? `**Accent Preference: AMERICAN** - Default to American voices unless nationality strongly requires otherwise.

\`\`\`
CHARACTER ANALYSIS
         │
         ▼
┌─────────────────────────────┐
│ Is character EXPLICITLY     │
│ British/Irish/Australian?   │
└─────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
   YES        NO → Use American voice
    │              ${getVoiceExamples.americanExamples}
    ▼
┌─────────────────────────────┐
│ Use matching accent from    │
│ the available voices list   │
└─────────────────────────────┘
\`\`\`

**Key Points:**
- American is the DEFAULT for all neutral/unspecified characters
- Only switch accents when nationality is EXPLICIT in the script
- "A teacher" → American | "A British teacher" → British
- When in doubt, use American` : `**Accent Preference: BRITISH** - Default to British voices unless nationality strongly requires otherwise.

\`\`\`
CHARACTER ANALYSIS
         │
         ▼
┌─────────────────────────────┐
│ Is character EXPLICITLY     │
│ American/Irish/Australian?  │
└─────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
   YES        NO → Use British voice
    │              ${getVoiceExamples.britishExamples || 'British accent voices'}
    ▼
┌─────────────────────────────┐
│ Use matching accent from    │
│ the available voices list   │
└─────────────────────────────┘
\`\`\`

**Key Points:**
- British is the DEFAULT for all neutral/unspecified characters
- Only switch accents when nationality is EXPLICIT in the script
- "A teacher" → British | "An American teacher" → American
- When in doubt, use British`}

**CRITICAL: Only use voices from the available voice list provided below. Do NOT use voice names that aren't in the list.**
` : ''}

${getVoiceReference()}

## Output Format

**You MUST follow this exact format:**

\`\`\`
TITLE: [Descriptive title for the listening exercise]

VOICE_ASSIGNMENTS:
[Speaker1]: [VoiceName]
[Speaker2]: [VoiceName]

DIALOGUE:
[Speaker1]: [First line of dialogue]

[Speaker2]: [Response]

[Speaker1]: [Continue dialogue...]

(Continue with natural conversation flow, use blank lines between speaker turns)
\`\`\`

## Content Guidelines for ${difficulty} Level

${difficulty === 'A1' ? `
- Use only present tense (simple present, present continuous)
- Vocabulary: 500-800 most common words
- Short sentences (5-10 words)
- Clear pronunciation cues
- Lots of repetition
- Basic greetings and everyday phrases
` : difficulty === 'A2' ? `
- Use present and past tense
- Vocabulary: 1000-1500 common words
- Simple compound sentences
- Common idioms and expressions
- Everyday situations
- Some use of future tense (going to)
` : difficulty === 'B1' ? `
- Use all basic tenses including present perfect
- Vocabulary: 2000-3000 words
- Complex sentences with subordinate clauses
- Express opinions and feelings
- Discuss familiar topics in depth
- Some conditional sentences (first and second)
` : difficulty === 'B2' ? `
- Use all tenses including past perfect
- Vocabulary: 4000-5000 words
- Sophisticated sentence structures
- Abstract concepts and ideas
- Idiomatic expressions
- Nuanced opinions and arguments
- All conditional forms
` : `
- Full range of grammatical structures
- Academic and professional vocabulary
- Complex ideas and abstract concepts
- Subtle humor and cultural references
- Implied meanings and subtext
- Sophisticated discourse markers
`}

## Additional Requirements

1. Make the dialogue natural and engaging
2. Include at least one comprehension-check moment (e.g., one speaker clarifying something)
3. Use appropriate fillers and discourse markers for the level (um, well, you know, etc.)
4. Include varied intonation cues in the text (questions, exclamations, emphasis)
5. End with a natural conclusion

Now generate the listening exercise:`;

    setGeneratedPrompt(prompt);
    return prompt;
  };

  const copyToClipboard = async () => {
    const prompt = generatedPrompt || generatePrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleGenerate = () => {
    generatePrompt();
  };

  const shuffleTopic = () => {
    // Get a different topic than the current one
    let newTopic = EFL_TOPICS[Math.floor(Math.random() * EFL_TOPICS.length)];
    // Avoid selecting the same topic
    while (newTopic === currentRandomTopic && EFL_TOPICS.length > 1) {
      newTopic = EFL_TOPICS[Math.floor(Math.random() * EFL_TOPICS.length)];
    }
    setCurrentRandomTopic(newTopic);
    setUseRandomTopic(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">EFL Listening Prompt Builder</h2>
              <p className="text-sm text-slate-500">Generate prompts for your LLM to create listening exercises</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Engine & Tier */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">TTS Engine</label>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg font-medium text-sm">
                {engine === EngineType.GEMINI ? 'Gemini TTS' : 'ElevenLabs'}
              </span>
              {engine === EngineType.ELEVEN_LABS && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setElevenLabsTier('free')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      elevenLabsTier === 'free'
                        ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Free Tier (21 voices)
                  </button>
                  <button
                    onClick={() => setElevenLabsTier('paid')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      elevenLabsTier === 'paid'
                        ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Paid Tier (43+ voices)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Accent Preference (ElevenLabs only) */}
          {engine === EngineType.ELEVEN_LABS && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Accent Preference</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAccentPreference('auto')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    accentPreference === 'auto'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Auto
                </button>
                <button
                  onClick={() => setAccentPreference('american')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    accentPreference === 'american'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  American
                </button>
                <button
                  onClick={() => setAccentPreference('british')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    accentPreference === 'british'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  British
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {accentPreference === 'auto' && 'LLM will choose accents based on character nationality and context'}
                {accentPreference === 'american' && 'Prefer American voices, but other accents may be used when appropriate'}
                {accentPreference === 'british' && 'Prefer British voices, but other accents may be used when appropriate'}
              </p>
            </div>
          )}

          {/* Difficulty Level */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">CEFR Difficulty Level</label>
            <div className="grid grid-cols-5 gap-2">
              {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                    difficulty === level
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">{CEFR_DESCRIPTIONS[difficulty]}</p>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Topic</label>
            <div className="flex gap-2">
              <button
                onClick={() => setUseRandomTopic(true)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  useRandomTopic
                    ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Random Topic
              </button>
              <button
                onClick={() => setUseRandomTopic(false)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  !useRandomTopic
                    ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Custom Topic
              </button>
            </div>
            {useRandomTopic ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                  <span className="text-slate-700 font-medium">{currentRandomTopic}</span>
                </div>
                <button
                  onClick={shuffleTopic}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 font-medium transition-colors"
                >
                  🎲 Shuffle
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a custom topic (e.g., 'Discussing climate change')"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Duration</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setDuration(preset.value);
                    setUseCustomDuration(false);
                  }}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    !useCustomDuration && duration === preset.value
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setUseCustomDuration(true)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  useCustomDuration
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Custom
              </button>
            </div>
            {useCustomDuration && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="Duration in seconds"
                  className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-sm text-slate-500">seconds</span>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Target word count: {getWordCount().min}-{getWordCount().max} words
            </p>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/30"
          >
            Generate Prompt
          </button>

          {/* Generated Prompt Preview */}
          {generatedPrompt && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Generated Prompt</label>
                <button
                  onClick={copyToClipboard}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {copied ? (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="w-4 h-4" />
                      Copy to Clipboard
                    </>
                  )}
                </button>
              </div>
              <div className="bg-slate-900 rounded-xl p-4 max-h-64 overflow-y-auto">
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                  {generatedPrompt}
                </pre>
              </div>
              <p className="text-xs text-slate-500">
                Copy this prompt and paste it into your LLM (ChatGPT, Claude, Gemini, etc.)
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            After your LLM generates the dialogue, copy the result back into the editor above.
            The format will be automatically parsed for voice assignments.
          </p>
        </div>
      </div>
    </div>
  );
};
