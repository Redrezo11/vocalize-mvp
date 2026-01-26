# Voice Assignment Guide for LLM-Generated Content

This document provides comprehensive voice information and selection flowcharts for AI-assisted content generation with DialogueForge. Use this as a reference when prompting an LLM to generate dialogue scripts with appropriate voice assignments.

---

## Table of Contents

1. [Gemini TTS Voice Reference](#gemini-tts-voice-reference)
2. [ElevenLabs Voice Reference](#elevenlabs-voice-reference)
3. [Voice Selection Flowcharts](#voice-selection-flowcharts)
4. [LLM Prompt Template](#llm-prompt-template)

---

## Gemini TTS Voice Reference

Google Gemini TTS offers 30 voices with distinct characteristics. Each voice has a single-word style descriptor that defines its personality.

### Female Voices (14 voices)

| Voice Name | Style | Best For | Character Archetypes |
|------------|-------|----------|---------------------|
| **Aoede** | Breezy | Casual narration, friendly dialogue | Friendly neighbor, relaxed host, lifestyle blogger |
| **Kore** | Firm | Authoritative content, instructions | Teacher, manager, news anchor, professional |
| **Leda** | Youthful | Young characters, energetic content | Teenager, young adult, student, enthusiastic guide |
| **Zephyr** | Bright | Upbeat content, positive messaging | Cheerful host, motivational speaker, children's content |
| **Autonoe** | Warm | Comforting content, emotional scenes | Mother figure, counselor, storyteller, mentor |
| **Callirhoe** | Gentle | Soft narration, bedtime stories | Caregiver, meditation guide, soft narrator |
| **Despina** | Smooth | Professional content, corporate | Business presenter, luxury brand, sophisticated host |
| **Erinome** | Clear | Educational content, instructions | Lecturer, tutor, explainer, documentary narrator |
| **Gacrux** | Mature | Wise characters, serious content | Executive, elder, experienced professional |
| **Laomedeia** | Calm | Meditation, relaxation content | Wellness guide, therapist voice, ASMR |
| **Pulcherrima** | Elegant | High-end content, formal settings | Gala host, art curator, classical music narrator |
| **Sulafat** | Serene | Peaceful content, nature themes | Nature documentary, spa, mindfulness |
| **Vindemiatrix** | Refined | Cultured content, sophisticated | Museum guide, wine connoisseur, literary reader |
| **Achernar** | Soft | Intimate content, gentle delivery | Confidant, bedtime narrator, poetry reader |

### Male Voices (16 voices)

| Voice Name | Style | Best For | Character Archetypes |
|------------|-------|----------|---------------------|
| **Puck** | Upbeat | Energetic content, entertainment | Game show host, sports commentator, excited narrator |
| **Charon** | Informative | Educational, documentary | Professor, historian, science explainer |
| **Fenrir** | Excitable | Action content, high energy | Adventure narrator, gaming content, thriller |
| **Orus** | Firm | Authoritative, commanding | Military commander, CEO, serious announcer |
| **Achird** | Friendly | Conversational, approachable | Helpful guide, customer service, friendly neighbor |
| **Algenib** | Gravelly | Rugged characters, drama | Detective, cowboy, weathered veteran |
| **Algieba** | Smooth | Professional, polished | Radio DJ, luxury brand, suave character |
| **Alnilam** | Firm | Structured content, formal | Lawyer, judge, formal announcer |
| **Enceladus** | Breathy | Intimate, dramatic | Romantic lead, thriller narrator, suspense |
| **Iapetus** | Deep | Bass-heavy, powerful | Movie trailer, villain, authoritative figure |
| **Rasalgethi** | Lively | Dynamic content, variety | Talk show host, podcast host, entertainer |
| **Sadachbia** | Clear | Articulate content, precision | News reader, technical explainer, instructor |
| **Sadaltager** | Knowledgeable | Expert content, authority | Expert witness, consultant, academic |
| **Schedar** | Professional | Business, corporate | CEO address, corporate training, business news |
| **Umbriel** | Relaxed | Laid-back content, casual | Podcast host, casual guide, chill narrator |
| **Zubenelgenubi** | Casual | Everyday conversation | Friend, casual blogger, relaxed storyteller |

### Gemini Style Prompting Tips

Gemini TTS supports natural language style instructions. You can enhance voice delivery with:

- **Accent hints**: "Southern California valley girl", "British received pronunciation"
- **Emotion**: "with barely contained excitement", "with a hint of sadness"
- **Pacing**: "slowly and deliberately", "rapid-fire delivery"
- **Physical cues**: "as if smiling", "with a whisper"

---

## ElevenLabs Voice Reference

ElevenLabs offers voices across two tiers:
- **Default/Premade Voices (FREE TIER)**: ~21 core voices available to all users
- **Extended + Voice Library (PAID TIER)**: 50+ default voices + 10,000+ community voices

> **Important**: The Voice Library API access requires a paid plan. Free tier users can only access the default premade voices.

### Voice Categories

**Age Groups:**
- Young (teens to 20s)
- Middle-aged (30s to 50s)
- Old (60+)

**Primary Accents:**
- American (most common)
- British (various: RP, Essex)
- Australian
- Irish
- Swedish-accented English
- Italian-accented English

---

### FREE TIER VOICES (Default/Premade - Available to All Users)

These voices are available on the free plan and are optimized for English but work across 29 languages.

#### Free Tier - Female Voices (8 voices)

| Name | Voice ID | Age | Accent | Style | Best Use Cases |
|------|----------|-----|--------|-------|----------------|
| **Rachel** | 21m00Tcm4TlvDq8ikWAM | Young | American | Calm | Narration, audiobooks, general purpose |
| **Domi** | AZnzlk1XvdvUeBnXmlld | Young | American | Strong | Powerful narration, motivation |
| **Sarah** | EXAVITQu4vr4xnSDxMaL | Young | American | Soft | News, gentle delivery |
| **Emily** | LcfcDJNUP1GQjkzn1xUU | Young | American | Calm | Meditation, relaxation content |
| **Dorothy** | ThT5KcBeYPX3keUQqHPh | Young | British | Pleasant | Children's stories, gentle narration |
| **Freya** | jsCqWAovK2LkecY7zXl4 | Young | American | Neutral | General purpose, versatile |
| **Gigi** | jBpfuIE2acCO8z3wKNLl | Young | American | Childish | Animation, children's content |
| **Charlotte** | XB0fDUnXU5powFXDhCwa | Middle-aged | English-Swedish | Seductive | Video games, character acting |

#### Free Tier - Male Voices (13 voices)

| Name | Voice ID | Age | Accent | Style | Best Use Cases |
|------|----------|-----|--------|-------|----------------|
| **Adam** | pNInz6obpgDQGcFmaJgB | Middle-aged | American | Deep | Narration, authoritative content |
| **Antoni** | ErXwobaYiN019PkySvjV | Young | American | Well-rounded | General narration, versatile |
| **Arnold** | VR6AewLTigWG4xSOukaG | Middle-aged | American | Crisp | Clear narration, professional |
| **Josh** | TxGEqnHWrfWFTfGW9XjX | Young | American | Deep | Narration, young authority |
| **Sam** | yoZ06aMxZJJ28mfd3POQ | Young | American | Raspy | Narration, edgy content |
| **Thomas** | GBv7mTt0atIp3Br8iCZE | Young | American | Calm | Meditation, relaxation |
| **Clyde** | 2EiwWnXFnvU5JabPnv8n | Middle-aged | American | War veteran | Video games, military characters |
| **Dave** | CYw3kZ02Hs0563khs1Fj | Young | British-Essex | Conversational | Gaming, casual British |
| **Fin** | D38z5RcWu1voky8WS1ja | Old | Irish | Sailor-like | Video games, character roles |
| **Harry** | SOYHLrjzK2X1ezoPC6cr | Young | American | Anxious | Video games, nervous characters |
| **Daniel** | onwK4e9ZLuTAKqWW03F9 | Middle-aged | British | Deep | News presenter, authority |
| **George** | JBFqnCBsd6RMkjVDRZzb | Middle-aged | British | Raspy | Narration, dramatic |
| **Callum** | N2lVS1w4EtoT3dr4eOWO | Middle-aged | American | Hoarse | Video games, rugged characters |

#### Free Tier Quick Reference

```
NARRATOR TYPE          → RECOMMENDED FREE TIER VOICE
───────────────────────────────────────────────────────
Neutral/Professional   → Rachel (F), Antoni (M)
Warm Storyteller       → Dorothy (F), Adam (M)
Authoritative          → Daniel (M), Adam (M)
Young/Energetic        → Gigi (F), Josh (M)
Calm/Meditative        → Emily (F), Thomas (M)
News/Formal            → Sarah (F), Daniel (M)
Character Voice (M)    → Clyde, Callum, Fin
Character Voice (F)    → Charlotte, Domi
Children's Content     → Gigi (F), Dorothy (F)
Edgy/Raspy            → Sam (M), George (M)
```

---

### PAID TIER VOICES (Extended Default Voices)

These additional voices require a paid ElevenLabs subscription.

#### Paid Tier - Female Voices (8 additional voices)

| Name | Voice ID | Age | Accent | Style | Best Use Cases |
|------|----------|-----|--------|-------|----------------|
| **Alice** | Xb7hH8MSUJpSbSDYk0k2 | Middle-aged | British | Confident | News, professional content |
| **Glinda** | z9fAnlkpzviPz146aGWa | Middle-aged | American | Witch-like | Video games, fantasy characters |
| **Grace** | oWAxZDx7w5VEj9dCyTzz | Young | American-Southern | Warm | Audiobooks, Southern characters |
| **Lily** | pFZP5JQG7iQjIQuC4Bku | Middle-aged | British | Raspy | Character narration, dramatic |
| **Matilda** | XrExE9yKIg1WjnnlVkGX | Young | American | Warm | Audiobooks, friendly narration |
| **Mimi** | zrHiDhphv9ZnVXBqCLjz | Young | English-Swedish | Childish | Animation, playful characters |
| **Nicole** | piTKgcLEGmPE4e6mEKli | Young | American | Whisper | ASMR, intimate audiobooks |
| **Serena** | pMsXgVXv3BLzUgSXRplE | Middle-aged | American | Pleasant | Interactive, conversational |

#### Paid Tier - Male Voices (14 additional voices)

| Name | Voice ID | Age | Accent | Style | Best Use Cases |
|------|----------|-----|--------|-------|----------------|
| **Bill** | pqHfZKP75CvOlQylNhV4 | Middle-aged | American | Strong | Documentary, trustworthy narrator |
| **Brian** | nPczCjzI2devNBz1zQrb | Middle-aged | American | Deep | Narration, bass-heavy content |
| **Charlie** | IKne3meq5aSn9XLyUdCD | Middle-aged | Australian | Casual | Conversational, laid-back |
| **Chris** | iP95p4xoKVk53GoZ742B | Middle-aged | American | Casual | Conversational, friendly |
| **Drew** | 29vD33N1CtxCmqQRPOHJ | Middle-aged | American | Well-rounded | News, professional |
| **Ethan** | g5CIjZEefAph4nQFvHAz | Young | American | Soft | ASMR content |
| **Giovanni** | zcAOhNBS3c14rBihAFp1 | Young | English-Italian | Foreigner | Audiobook, international characters |
| **James** | ZQe5CZNOzWyzPSCn5a3c | Old | Australian | Calm | News, mature delivery |
| **Jeremy** | bVMeCyTHy58xNoL34h3p | Young | American-Irish | Excited | Narration, energetic |
| **Jessie** | t0jbNlBVZ17f02VDIeMI | Old | American | Raspy | Video games, aged characters |
| **Joseph** | Zlb1dXrM653N07WRdFW3 | Middle-aged | British | Professional | News, formal content |
| **Liam** | TX3LPaxmHKxFdv7VOQHJ | Young | American | Neutral | Narration, versatile |
| **Michael** | flq6f7yk4E4fJM5XTYuZ | Old | American | Wise | Audiobook, elder characters |
| **Patrick** | ODq5zmih8GrVes37Dizd | Middle-aged | American | Shouty | Video games, intense characters |
| **Paul** | 5Q0t7uMcjvnagumLfvZi | Middle-aged | American | Reporter | News, field reporting |

---

### ElevenLabs Voice Labels Schema

When the API returns voices, they include these label fields:
```json
{
  "voice_id": "string",
  "name": "string",
  "labels": {
    "gender": "male|female|neutral",
    "age": "young|middle_aged|old",
    "accent": "american|british|australian|irish|...",
    "description": "string (e.g., 'calm', 'raspy')",
    "use_case": "narration|news|video_games|audiobook|..."
  }
}
```

---

## Voice Selection Flowcharts

### Gemini Voice Selection Flowchart

```
START: Character/Narrator Analysis
            │
            ▼
┌─────────────────────────────┐
│  What is the character's    │
│  GENDER?                    │
└─────────────────────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
  FEMALE         MALE
     │             │
     ▼             ▼
┌─────────────────────────────┐
│  What is the PRIMARY TONE?  │
└─────────────────────────────┘
            │
┌───────────┼───────────┬───────────┬───────────┐
▼           ▼           ▼           ▼           ▼
AUTHORITATIVE  WARM/FRIENDLY  ENERGETIC   CALM/SOFT   PROFESSIONAL
│           │           │           │           │
│ FEMALE:   │ FEMALE:   │ FEMALE:   │ FEMALE:   │ FEMALE:
│ • Kore    │ • Autonoe │ • Zephyr  │ • Laomedeia│ • Despina
│ • Gacrux  │ • Callirhoe│ • Leda   │ • Achernar │ • Pulcherrima
│           │ • Sulafat │ • Aoede   │ • Sulafat  │ • Vindemiatrix
│           │           │           │           │
│ MALE:     │ MALE:     │ MALE:     │ MALE:     │ MALE:
│ • Orus    │ • Achird  │ • Puck    │ • Umbriel │ • Schedar
│ • Alnilam │ • Zubenelgenubi│ • Fenrir │ • Enceladus│ • Sadaltager
│ • Iapetus │ • Rasalgethi│         │           │ • Charon
            │
            ▼
┌─────────────────────────────┐
│  REFINE by CHARACTER TYPE   │
└─────────────────────────────┘
            │
┌───────────┼───────────┬───────────┬───────────┐
▼           ▼           ▼           ▼           ▼
NARRATOR    TEACHER     STORYTELLER YOUTH      VILLAIN/DRAMA
│           │           │           │           │
│ • Charon  │ • Erinome │ • Autonoe │ • Leda    │ • Iapetus
│ • Sadachbia│ • Kore   │ • Callirhoe│ • Zephyr │ • Algenib
│ • Despina │ • Sadaltager│ • Achird │ • Puck   │ • Enceladus
│ • Bill    │ • Charon  │ • Umbriel │ • Fenrir  │ • Orus
            │
            ▼
      FINAL SELECTION
```

### ElevenLabs Voice Selection Flowchart

```
START: Character/Narrator Analysis
            │
            ▼
┌─────────────────────────────┐
│  What is your PLAN TIER?    │
└─────────────────────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
   FREE          PAID
     │             │
     │             └──► All 43+ voices available
     │
     ▼
┌─────────────────────────────┐
│  FREE TIER: 21 voices only  │
│  (See restricted list)      │
└─────────────────────────────┘
            │
            ▼
┌─────────────────────────────┐
│  What is the USE CASE?      │
└─────────────────────────────┘
            │
┌───────────┼───────────┬───────────┬───────────┐
▼           ▼           ▼           ▼           ▼
NARRATION   NEWS/FORMAL VIDEO GAMES AUDIOBOOK  CONVERSATIONAL
            │
            ▼
┌─────────────────────────────┐
│  What is the character's    │
│  AGE GROUP?                 │
└─────────────────────────────┘
            │
     ┌──────┼──────┐
     ▼      ▼      ▼
   YOUNG  MIDDLE  OLD
     │      │      │
     ▼      ▼      ▼
┌─────────────────────────────┐
│  What ACCENT is needed?     │
└─────────────────────────────┘
            │
┌───────────┼───────────┬───────────┐
▼           ▼           ▼           ▼
AMERICAN    BRITISH     AUSTRALIAN  OTHER

FREE TIER OPTIONS:
─────────────────────────────────────────────────────
│ AMERICAN         │ BRITISH      │ OTHER          │
│ Young F:         │ Young F:     │ Irish:         │
│ • Rachel ✓       │ • Dorothy ✓  │ • Fin ✓        │
│ • Emily ✓        │              │ Swedish:       │
│ • Gigi ✓         │ Middle M:    │ • Charlotte ✓  │
│ • Freya ✓        │ • Daniel ✓   │                │
│ • Domi ✓         │ • George ✓   │                │
│                  │              │                │
│ Young M:         │ Young M:     │                │
│ • Antoni ✓       │ • Dave ✓     │                │
│ • Josh ✓         │              │                │
│ • Sam ✓          │              │                │
│ • Thomas ✓       │              │                │
│ • Harry ✓        │              │                │
│                  │              │                │
│ Middle M:        │              │                │
│ • Adam ✓         │              │                │
│ • Arnold ✓       │              │                │
│ • Clyde ✓        │              │                │
│ • Callum ✓       │              │                │
─────────────────────────────────────────────────────

PAID TIER ADDITIONS (not available on free):
─────────────────────────────────────────────────────
│ AMERICAN         │ BRITISH      │ AUSTRALIAN     │
│ Young F:         │ Middle F:    │ Middle M:      │
│ • Matilda ✗      │ • Alice ✗    │ • Charlie ✗    │
│ • Grace ✗        │ • Lily ✗     │ • James ✗      │
│ • Nicole ✗       │ Middle M:    │                │
│ • Mimi ✗         │ • Joseph ✗   │ Italian:       │
│ • Glinda ✗       │              │ • Giovanni ✗   │
│                  │              │                │
│ Middle F:        │              │                │
│ • Serena ✗       │              │                │
│                  │              │                │
│ Middle/Old M:    │              │                │
│ • Bill ✗         │              │                │
│ • Brian ✗        │              │                │
│ • Chris ✗        │              │                │
│ • Drew ✗         │              │                │
│ • Jeremy ✗       │              │                │
│ • Jessie ✗       │              │                │
│ • Liam ✗         │              │                │
│ • Michael ✗      │              │                │
│ • Patrick ✗      │              │                │
│ • Paul ✗         │              │                │
│ • Ethan ✗        │              │                │
─────────────────────────────────────────────────────
            │
            ▼
┌─────────────────────────────┐
│  REFINE by VOICE QUALITY    │
└─────────────────────────────┘
            │
FREE TIER VOICE QUALITIES:
─────────────────────────────────────────────────────
│ DEEP/BASS  │ SOFT/CALM │ RASPY/EDGY │ CLEAR     │
│ • Adam ✓   │ • Rachel ✓│ • Sam ✓    │ • Antoni ✓│
│ • Josh ✓   │ • Emily ✓ │ • Callum ✓ │ • Arnold ✓│
│ • Daniel ✓ │ • Thomas ✓│ • George ✓ │ • Sarah ✓ │
│            │ • Sarah ✓ │            │ • Dorothy ✓│
─────────────────────────────────────────────────────
            │
            ▼
      FINAL SELECTION
```

### Quick Reference Decision Tree

```
NARRATOR TYPE          → GEMINI PICK      → ELEVENLABS FREE    → ELEVENLABS PAID
──────────────────────────────────────────────────────────────────────────────────
Neutral/Professional   → Charon, Erinome  → Rachel, Antoni     → + Alice, Drew
Warm Storyteller       → Autonoe, Achird  → Dorothy, Adam      → + Matilda, Bill
Authoritative          → Orus, Kore       → Adam, Daniel       → + Bill, James
Young/Energetic        → Puck, Leda       → Josh, Domi         → + Jeremy, Patrick
Calm/Meditative        → Laomedeia, Umbriel→ Thomas, Emily     → + Nicole, Ethan
News/Formal            → Sadachbia, Schedar→ Sarah, Daniel     → + Alice, Drew
Character Voice (M)    → Algenib, Fenrir  → Clyde, Callum      → + Jessie, Giovanni
Character Voice (F)    → Gacrux, Zephyr   → Charlotte, Domi    → + Glinda, Lily
Children's Content     → Callirhoe, Leda  → Gigi, Dorothy      → + Mimi
Edgy/Dramatic          → Enceladus, Iapetus→ Sam, George       → + Brian, Jessie

✓ = Available on FREE tier
+ = Additional options on PAID tier only
```

---

## LLM Prompt Template

Use this template when asking an LLM to generate dialogue content with voice assignments:

### System Prompt for Voice-Assigned Content Generation

```
You are a dialogue script writer for DialogueForge, a multi-voice TTS application.
Your task is to create engaging dialogue scripts with appropriate voice assignments.

## Output Format Requirements

Your output MUST follow this exact format:

```
Title: [Descriptive title for the audio]

Voice Assignments:
- [Speaker Name]: [Voice Name] (Gemini) or [Voice Name] (ElevenLabs)
- [Speaker Name]: [Voice Name] (Gemini) or [Voice Name] (ElevenLabs)

---

[Speaker Name]: [Dialogue text]

[Speaker Name]: [Dialogue text]

...
```

## TTS Engine Selection

The user will specify one of the following:
- **Gemini TTS**: All 30 voices are available (no tier restrictions)
- **ElevenLabs FREE**: Only use the 21 free tier voices listed below
- **ElevenLabs PAID**: All 43+ default voices are available

## Available Voices

### For Gemini TTS (All voices available):
Female: Aoede (Breezy), Kore (Firm), Leda (Youthful), Zephyr (Bright), Autonoe (Warm),
        Callirhoe (Gentle), Despina (Smooth), Erinome (Clear), Gacrux (Mature),
        Laomedeia (Calm), Pulcherrima (Elegant), Sulafat (Serene), Vindemiatrix (Refined),
        Achernar (Soft)
Male:   Puck (Upbeat), Charon (Informative), Fenrir (Excitable), Orus (Firm),
        Achird (Friendly), Algenib (Gravelly), Algieba (Smooth), Alnilam (Firm),
        Enceladus (Breathy), Iapetus (Deep), Rasalgethi (Lively), Sadachbia (Clear),
        Sadaltager (Knowledgeable), Schedar (Professional), Umbriel (Relaxed),
        Zubenelgenubi (Casual)

### For ElevenLabs FREE TIER (21 voices only):
Female: Rachel (Calm), Domi (Strong), Sarah (Soft), Emily (Calm), Dorothy (Pleasant),
        Freya (Neutral), Gigi (Childish), Charlotte (Seductive)
Male:   Adam (Deep), Antoni (Well-rounded), Arnold (Crisp), Josh (Deep), Sam (Raspy),
        Thomas (Calm), Clyde (War veteran), Dave (Conversational), Fin (Sailor),
        Harry (Anxious), Daniel (Deep), George (Raspy), Callum (Hoarse)

### For ElevenLabs PAID TIER (all voices):
[All FREE tier voices PLUS:]
Female: Alice (Confident), Glinda (Witch-like), Grace (Warm), Lily (Raspy),
        Matilda (Warm), Mimi (Childish), Nicole (Whisper), Serena (Pleasant)
Male:   Bill (Strong), Brian (Deep), Charlie (Casual), Chris (Casual), Drew (Well-rounded),
        Ethan (Soft), Giovanni (Foreigner), James (Calm), Jeremy (Excited),
        Jessie (Raspy), Joseph (Professional), Liam (Neutral), Michael (Wise),
        Patrick (Shouty), Paul (Reporter)

## Voice Selection Guidelines

1. **Match voice to character personality**
   - Authoritative characters → Firm/Professional voices
   - Friendly characters → Warm/Casual voices
   - Young characters → Youthful/Bright voices
   - Wise characters → Mature/Knowledgeable voices

2. **Ensure voice diversity**
   - Use different voices for different speakers
   - Vary voice styles to create contrast
   - Consider gender balance when appropriate

3. **Match voice to content type**
   - Educational → Clear, Informative voices
   - Entertainment → Energetic, Lively voices
   - Meditation → Calm, Soft voices
   - Drama → Expressive, Dynamic voices

4. **Consider accent appropriateness**
   - Match accent to character background
   - Use neutral accents for general content
   - Use specific accents for character authenticity

5. **CRITICAL: Respect tier restrictions**
   - If user specifies "ElevenLabs FREE", ONLY use the 21 free tier voices
   - Never suggest paid voices to free tier users
```

### Example User Prompts

#### Example 1: Gemini (No Tier Restrictions)
```
Create a 2-minute educational dialogue about the water cycle for middle school students.
Use Gemini voices.

Requirements:
- One narrator (authoritative but friendly)
- Two student characters (curious, asking questions)
- Include engaging questions and clear explanations
```

#### Example 2: ElevenLabs Free Tier
```
Create a short podcast intro with two hosts discussing AI technology.
Use ElevenLabs FREE tier voices only.

Requirements:
- Two hosts with contrasting personalities
- Casual, conversational tone
- About 30 seconds of dialogue
```

#### Example 3: ElevenLabs Paid Tier
```
Create a dramatic audiobook scene with multiple characters.
Use ElevenLabs PAID tier (full voice selection).

Requirements:
- Narrator with mature, authoritative voice
- Young female protagonist
- Elderly male mentor character
- Include emotional range
```

### Example LLM Output

```
Title: The Amazing Water Cycle Adventure

Voice Assignments:
- Narrator: Charon (Gemini) - Informative yet engaging
- Maya: Leda (Gemini) - Youthful and curious
- Jake: Puck (Gemini) - Upbeat and enthusiastic

---

Narrator: Today, we're going on an incredible journey following a single drop of water as it travels around our planet!

Maya: Wait, water actually travels? I thought it just stayed in the ocean or lakes.

Narrator: Great observation, Maya! Water is constantly moving in what we call the water cycle. Let's start with our water droplet sitting in the warm ocean.

Jake: Ooh, like a vacation for water! But how does it leave the ocean?

Narrator: The sun heats the ocean surface, and something magical happens - evaporation. Our water droplet turns into water vapor and floats up into the sky.

Maya: So it becomes invisible? Like a ghost?

Narrator: Exactly! The water vapor rises higher and higher until it reaches cooler air. Then it condenses, meaning it turns back into tiny water droplets that form clouds.

Jake: That's so cool! So clouds are actually made of water?

Narrator: Precisely! And when those droplets combine and get heavy enough, they fall back to Earth as precipitation - rain, snow, sleet, or hail.

Maya: And then the cycle starts all over again?

Narrator: You've got it! This cycle has been running for billions of years, recycling the same water over and over. The water you drink today might have once been drunk by a dinosaur!

Jake: No way! That's amazing!
```

---

## Voice Assignment Checklist

Before finalizing voice assignments, verify:

- [ ] Each speaker has a unique voice
- [ ] Voice styles match character personalities
- [ ] Voice ages match character ages
- [ ] Accents are appropriate for the content
- [ ] There's sufficient variety between voices
- [ ] The narrator voice suits the content tone
- [ ] All voice names are spelled correctly
- [ ] Voice gender matches character gender (unless intentionally different)
- [ ] **For ElevenLabs FREE tier**: All selected voices are in the 21-voice free list
- [ ] **For ElevenLabs PAID tier**: User has confirmed paid subscription before using extended voices

---

## Sources

- [Google Gemini Speech Generation Documentation](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Google Gemini 2.5 TTS Improvements Blog](https://blog.google/technology/developers/gemini-2-5-text-to-speech/)
- [ElevenLabs Voice Library Documentation](https://elevenlabs.io/docs/creative-platform/voices/voice-library)
- [ElevenLabs Voices Overview](https://elevenlabs.io/docs/overview/capabilities/voices)
- [ElevenLabs Premade Voices Reference](https://elevenlabs-sdk.mintlify.app/voices/premade-voices)
