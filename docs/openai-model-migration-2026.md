# Migrating off OpenAI's retired GPT-5 and text-to-speech models

**A field guide from Vocalize (October 2026)**

> **Disclaimer — read before reusing.** This guide was researched and written for one app,
> Vocalize (an ESL test generator), and its specific needs: JSON-producing chat calls through the
> Responses API, and short "text in, mp3 out" speech for dialogue lines, vocabulary lists and
> classroom narration, where OpenAI is mostly a *fallback* behind Gemini TTS. The findings in
> Part 1 were verified against OpenAI's live documentation and live API calls on **3 October 2026**
> and will go stale. The decisions in Part 2 weigh cost, risk and deadlines *for this app*. Another
> project should treat Part 1 as a starting checklist to re-verify, and Part 2 as one worked example,
> not a recommendation. If your app needs word timestamps, long-form narration, streaming, or
> speech *input*, your trade-offs differ — see the sibling project's guide at
> `C:\projects\ChaulkieClone\documentation\openai-voice-migration.md`, which solved a different
> shape of the same problem (lesson narration with word-level highlighting).

---

## Part 1 — What we learned (transferable)

### 1.1 Two separate deprecations, announced months apart

OpenAI's email about the TTS shutdown was the one people noticed. The chat-model shutdown was
announced earlier, in a separate entry, and **lands first**. Check the full
[deprecations page](https://developers.openai.com/api/docs/deprecations), not the email.

| Retired | Shutdown | OpenAI's named replacement | Notes |
|---|---|---|---|
| `gpt-5-mini-2025-08-07` | **11 Dec 2026** | `gpt-5.6-terra` | The undated alias `gpt-5-mini` points at this one snapshot — it dies too |
| `gpt-5-nano-2025-08-07` | **11 Dec 2026** | `gpt-5.6-luna` | Same: alias `gpt-5-nano` has a single snapshot |
| `gpt-5-2025-08-07`, `gpt-5-pro`, `o3`, `o3-pro` | 11 Dec 2026 | `gpt-5.6-sol` | Not used by Vocalize |
| `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` (all snapshots) | **6 Jan 2027** | `gpt-realtime-2.1-mini` | **No model remains for `POST /v1/audio/speech`** |
| `gpt-audio-mini` (both snapshots), `gpt-audio`, `gpt-4o-audio`, `gpt-4o-mini-audio` | 20 Jan 2027 | `gpt-audio-1.5` | Closes the cheap REST audio route |
| `whisper-1`, `gpt-4o-transcribe*` | 26 Feb 2027 | `gpt-transcribe` | Vocalize has no speech input; irrelevant here |

**Not deprecated** (as of 3 Oct 2026): `gpt-5.2`, `gpt-5.4-mini`, `gpt-4o-mini`, `gpt-audio-1.5`,
`gpt-realtime-2.1-mini`.

As of this writing the official text-to-speech guide *still* recommends `gpt-4o-mini-tts` and the
[community thread](https://community.openai.com/t/tts-shutdown-email-tts-1-gpt-4o-mini-tts-jan-6-2027-isnt-on-the-deprecations-page/1402731)
has no staff reply. Don't wait for guidance.

### 1.2 Chat models: a rename plus one trap

We probed `gpt-5.6-luna` and `gpt-5.6-terra` through the Responses API with the exact request
shape Vocalize uses — `instructions` + `input`, `text.format: { type: 'json_object' }`,
optional `reasoning.effort`. Both returned well-formed JSON on every call.

| Model | Input / output per 1M tokens | Tier (OpenAI's words) | Probe |
|---|---|---|---|
| `gpt-5-mini` (dying) | $0.25 / $2.00 | — | — |
| `gpt-5-nano` (dying) | $0.05 / $0.40 | — | — |
| **`gpt-5.6-luna`** | **$0.20 / $1.20** | "cost-sensitive, high-volume … nano tier" | 3.0 s, JSON ok, `effort: none` ok |
| `gpt-5.6-terra` | $2.00 / $12.00 | "balance intelligence and cost … mini tier" | 1.7 s, JSON ok |
| `gpt-5.2` (kept) | $1.75 / $14.00 | — | — |

Observations:

- **OpenAI maps mini→terra, but terra costs 8× what gpt-5-mini did and the same as gpt-5.2.**
  Luna is the price-matched successor to gpt-5-mini. Which one is *right* depends on whether your
  output quality holds at the cheaper tier — test with your real prompts.
- **Omitting `reasoning` is not "no reasoning".** On 5.6 models the default effort is `medium`.
  In our probe, luna with no `reasoning` key spent 142 reasoning tokens and took 3.6 s; with
  `reasoning: { effort: 'none' }` it spent 0 and took 3.0 s. Allowed efforts on 5.6:
  `none, minimal, low, medium, high, xhigh, max`. (`none` returns HTTP 400 on some *newer* models
  such as GPT-6 Astra — check per model.) Any call you *intended* to be reasoning-free must say so
  explicitly.
- **`json_object` still works** but is documented as legacy; `json_schema` (Structured Outputs) is
  the recommended path. The "mention the word json in the prompt" rule for `json_object` still
  bites — keep it in your prompts, or move to `json_schema`.
- Output location is unchanged: `output[]` → item `type: 'message'` → `content[]` →
  `type: 'output_text'` → `.text`. A `type: 'reasoning'` item precedes it when reasoning ran.

### 1.3 Speech: the easy endpoint is gone; two chat models can replace it

There is no longer any model that takes text and returns an mp3 through `/v1/audio/speech`. Both
survivors are **chat models**: they will *answer* your text unless you instruct them to read it.
We confirmed this the hard way — given a dialogue line with no system prompt, `gpt-audio-1.5`
replied *"I'm actually not Sarah, but I can help you get ready for your trip!"*. With the verbatim
prompt below, both models read the line word-for-word (transcript identical to input).

| | `gpt-audio-1.5` | `gpt-realtime-2.1-mini` |
|---|---|---|
| Endpoint | **Chat Completions** (plain HTTPS). Not Responses. | **Realtime only** (`wss://api.openai.com/v1/realtime`). Not Chat, not Responses, not `/audio/speech`. |
| Request | `modalities: ['text','audio']`, `audio: { voice, format }` | `session.update` → `conversation.item.create` → `response.create` |
| Output | base64 at `choices[0].message.audio.data`; formats `wav, aac, mp3, flac, opus, pcm16` | base64 PCM16 deltas, 24 kHz mono (`audio/pcm`, `pcmu`, `pcma` only) — wrap to WAV yourself |
| Free transcript of what was spoken | `message.audio.transcript` | `response.output_audio_transcript.delta` events |
| Voices (verified by API) | `alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, marin, cedar` | `alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar` — **no `nova`, `onyx`, `fable`** (API rejects them) |
| Runs from a browser | Yes (same as `/audio/speech` did) | No — WebSocket auth needs a server |
| Price (audio output) | $64 / 1M tokens | $20 / 1M tokens |
| Measured, 7 s of speech | 164 audio tokens, 3–4.5 s latency, 69 KB mp3 | 144 audio tokens (+60 reasoning), 3.5 s, 346 KB PCM |
| **Cost per minute of speech** | **≈ $0.09** (~6.5× `gpt-4o-mini-tts`) | **≈ $0.027** (~1.9×) |
| 3-minute dialogue | ≈ $0.28 | ≈ $0.08 |

(`gpt-4o-mini-tts` was $12 / 1M audio tokens ≈ $0.014/min. Both models produce ~20–23 audio
tokens per second of speech.)

**The verbatim system prompt** (adapted from ChaulkieClone, where it has also held across English
and Arabic):

```
You are a text-to-speech engine, not an assistant. Read the user's message aloud exactly as
written, word for word. Do not answer it, comment on it, add, omit, translate or summarise
anything. Keep the language of the text. <your style/tone instruction here>
```

**Fidelity check.** Because a chat model *could* reword, compare the returned transcript with the
input (word-bag similarity, punctuation and case ignored). Retry once with a stricter suffix
(`Say ONLY the words of the message, in the same order, nothing before or after them.`) if it
drops below ~0.85, and flag the clip if it still does. Neither project has seen the guard fire,
but it costs nothing.

**Minimal `gpt-audio-1.5` call (what Vocalize will use):**

```ts
const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-audio-1.5',
    modalities: ['text', 'audio'],
    audio: { voice: 'coral', format: 'mp3' },
    messages: [
      { role: 'system', content: VERBATIM + ' Speak in a warm, friendly tone at a natural pace.' },
      { role: 'user', content: lineText },
    ],
  }),
});
const { choices, usage } = await res.json();
const mp3 = Buffer.from(choices[0].message.audio.data, 'base64');   // or atob → Blob in a browser
const spoken = choices[0].message.audio.transcript;                   // compare with lineText
const audioTokens = usage.completion_tokens_details.audio_tokens;     // for billing
```

For the realtime route (WebSocket, PCM→WAV, Cloudinary wav→mp3 conversion, retry rules), use
ChaulkieClone's `server/services/tts.ts` as the template — it is production code with measured
results, and nothing about it is specific to that app except the voice choice.

### 1.4 What we took from ChaulkieClone's guide, and what we left

**Took:** the verbatim prompt; the transcript fidelity check; model and voice names in environment
variables so the next retirement is a config change; distinguishing out-of-credits from
rate-limit errors (only one is worth retrying); "check the whole deprecations page".

**Left:** everything about Whisper, ElevenLabs Scribe, Deepgram and text-position timing
estimation (Vocalize never highlights words); the WebSocket/PCM/WAV pipeline and Cloudinary
format conversion (not needed if you pick `gpt-audio-1.5`); the Heroku 30-second request limit
concern (only matters if speech generation moves to the server).

### 1.5 Checklist for another project

1. `grep` every OpenAI model name and endpoint in your code *and* in your billing/pricing tables.
   Vocalize had model names in 14 files, including a server-side USD table keyed by model.
2. For each, read the **model page** (`developers.openai.com/api/docs/models/<name>`) — it lists
   snapshots, so you can tell whether an undated alias is affected.
3. For chat: pick a successor by *price tier you need*, not only by OpenAI's mapping; probe it with
   your real request shape; add `reasoning.effort` explicitly everywhere.
4. For speech: decide REST-and-expensive (`gpt-audio-1.5`) vs WebSocket-and-cheap
   (`gpt-realtime-2.1-mini`) based on your volume and whether you can run it server-side. Check
   your voice names against the table above. Add the verbatim prompt and the fidelity check.
5. Re-price. Both speech routes bill in *audio tokens* (≈20–23 per second); if your billing is
   per-character, convert (~1,400 audio tokens per minute ≈ 800 characters of English).
6. Deploy before **11 Dec 2026** (chat) and **6 Jan 2027** (speech).

---

## Part 2 — Vocalize's plan

> **Status (3 Oct 2026): implemented, not yet deployed.** Step 1 (chat) is commit `52d4fc6`, and
> step 2 (speech) is the commit after it. Section 2.5 records where the implementation departed
> from the plan below and what is still left to check by hand.

### 2.1 Decisions

| Question | Decision | Why |
|---|---|---|
| Replacement for `gpt-5-mini` (default content model) | **`gpt-5.6-luna`** | Price-matched (slightly cheaper), valid JSON in probes, so the token-price table in `utils/tokenCosts.ts` can stay. Terra would cost the same as our existing premium option `gpt-5.2`, making it redundant. **Quality must be checked with a Jam A/B before shipping** — if luna's dialogues are noticeably weaker, the fallback is terra *as the premium option replacing gpt-5.2*, not as the default. |
| Replacement for `gpt-5-nano` (SaveDialog title, TestBuilder helpers) | **`gpt-5.6-luna`** | OpenAI's own mapping; 4× nano's price but these are tiny calls. |
| `gpt-5.2`, `gpt-4o-mini` (gender check), `gpt-5.4-mini` (extraction) | **Unchanged** | Not deprecated. |
| Replacement for `gpt-4o-mini-tts` / `tts-1` | **`gpt-audio-1.5` via Chat Completions** | OpenAI speech is the *fallback* behind Gemini for dialogues, and direct only for lexis audio and classroom narration, which are short. The 6.5× cost is ≈ $0.20 extra on a rare 3-minute fallback. In exchange: the mp3 pipeline, `concatenateAudioBlobs`, the `GEMINI_TO_OPENAI` voice table (`nova`, `onyx`, `fable`, `verse` all still valid) and browser-side execution are unchanged. The realtime route would require moving speech to the server, a WebSocket client, WAV handling, per-segment requests under Heroku's 30 s limit and a voice-table rework — too much risk for the money on a fallback path. If OpenAI speech volume grows, realtime-mini is the cost-down plan and ChaulkieClone's `tts.ts` is the template. |
| Order | **Chat first, then speech** | Chat dies 11 Dec; speech 6 Jan. Target: chat merged by **mid-November**, speech by **mid-December**, leaving buffer for Heroku deploys and teacher-facing regressions. |
| Internal model keys | **Keep `'gpt-5-mini' \| 'gpt-5.2' \| 'claude-sonnet'`**; map to API names at call time | `content_model` is persisted per user (`server/index.js` User schema) and used as a billing key in `tokenCosts.ts` and the server cost tables. Renaming the key would orphan saved settings and historical usage rows. |

### 2.2 Step 1 — chat models (deadline 11 Dec 2026)

**1a. One place that knows API model names.** New `utils/openaiModels.ts`:

```ts
import type { ContentModel } from './tokenCosts';
// Internal key → OpenAI model id. Env overrides let us react to the next retirement without a deploy.
const FAST = import.meta.env.VITE_OPENAI_FAST_MODEL || 'gpt-5.6-luna';
export const OPENAI_MODEL: Record<Exclude<ContentModel, 'claude-sonnet'>, string> = {
  'gpt-5-mini': FAST,
  'gpt-5.2': import.meta.env.VITE_OPENAI_PREMIUM_MODEL || 'gpt-5.2',
};
export const OPENAI_UTILITY_MODEL = FAST;                 // replaces every 'gpt-5-nano' literal
export const OPENAI_SPEECH_MODEL = import.meta.env.VITE_OPENAI_SPEECH_MODEL || 'gpt-audio-1.5';  // step 2
export const toApiModel = (m: ContentModel) => OPENAI_MODEL[m as keyof typeof OPENAI_MODEL] ?? m;
```

**1b. Route every call through it.** Sites that pass the internal key straight to the API today:

| File | Lines (approx.) | Change |
|---|---|---|
| `components/JamButton.tsx` | 638, 814, 881, 998 (`model: profile.contentModel`) | `model: toApiModel(profile.contentModel)` |
| `components/JamButton.tsx` | 626, 992 (`generateBonusForTest(..., 'gpt-5-mini')`) | leave the key; map inside `callOpenAI` |
| `components/OneShotCreator.tsx` | 1176 (`model: 'gpt-5-mini'`), 1238/1453/1652 bonus calls | `toApiModel('gpt-5-mini')` |
| `components/FollowUpQuestions.tsx` | 116 `callOpenAI`, 420 model pick | map inside `callOpenAI` |
| `helpers/bonusGeneration.ts` | 7 `callOpenAI` | map inside |
| `utils/jsonRepair.ts` | 205 | `OPENAI_UTILITY_MODEL` |
| `components/SaveDialog.tsx` | 72 | `OPENAI_UTILITY_MODEL` |
| `components/TestBuilder.tsx` | 632, 847 | `OPENAI_UTILITY_MODEL` |
| `components/StudentTest.tsx` | 69 default `contentModel = 'gpt-5-mini'` | unchanged (internal key) |

The two duplicate `callOpenAI` helpers (`FollowUpQuestions.tsx:116`, `bonusGeneration.ts:7`)
should become one exported helper in `helpers/bonusGeneration.ts` (or a new `utils/openaiChat.ts`)
that takes the internal key, maps it, and accepts `reasoning`.

**1c. Make "no reasoning" explicit.** Every Responses call that omits `reasoning` *on purpose*
gets `reasoning: { effort: 'none' }`:

- `JamButton.tsx:817` / `:884` — `...(profile.useReasoning && { reasoning: { effort: 'low'|'medium' } })` becomes `reasoning: { effort: profile.useReasoning ? 'low'|'medium' : 'none' }`.
- `FollowUpQuestions.tsx` discussion generation (the "no reasoning for speed" call) — pass `{ effort: 'none' }`. Evaluation keeps `low`.
- `bonusGeneration.ts`, `jsonRepair.ts`, `SaveDialog.tsx`, `OneShotCreator.tsx:1176` — add `none` unless the call already sets an effort.

Note this is also a latency and cost *improvement*: on gpt-5-mini these calls were silently running
at medium effort too (the gpt-5 family had no `none`, only `minimal`).

**1d. Server tables.** `server/index.js`:

- USD pricing (~line 709): add `'llm:openai:gpt-5.6-luna': { perMillionTokens: 0.20 }` and
  `'llm:openai:gpt-5.6-terra': { perMillionTokens: 2.00 }`; correct `gpt-5-mini` from 0.40 to 0.25
  (stale). Usage rows are logged with the *API* model name, so this is where new names appear.
- Student token costs (~line 694) are keyed by internal key — unchanged.
- User schema `content_model` enum (~line 189) is `['gpt-5-mini','gpt-5.2']` — **`'claude-sonnet'` is
  missing**, a pre-existing bug: saving that setting fails validation. Add it while here.

**1e. Labels.** UI still says "GPT-5 Mini" in `Settings.tsx`, `HomePage.tsx`, `JamButton.tsx`
(`MODEL_CONFIG`, `operationDetail` strings). Either leave (teachers don't care about snapshot
names) or relabel to "Fast" / "Premium" so the next swap needs no UI change. Recommend the latter.

**1f. Verify.** A/B one Jam (listening, 2 speakers, B1) and one reading passage on `gpt-5-mini`
vs `gpt-5.6-luna`, same seed topic; check: transcript naturalness and CEFR fit, `VOICE_ASSIGNMENTS`
section present and parseable, question/lexis/preview JSON parses without `jsonRepair` firing,
bonus questions arrive, student discussion + evaluation round-trip, SaveDialog title suggestion,
TestBuilder helpers. Watch `UsageLog` to confirm reasoning tokens are 0 where expected.

### 2.3 Step 2 — speech (deadline 6 Jan 2027)

**2a. One speech helper.** New `utils/openaiSpeech.ts` exporting
`openaiSpeak({ text, voice, style? }): Promise<Blob>` that does the Chat Completions call from
§1.3 with `format: 'mp3'`, builds the system message as `VERBATIM + style`, decodes base64 to a
`Blob('audio/mpeg')`, runs the fidelity check against `message.audio.transcript` (one stricter
retry, then `console.warn` and continue), and returns `{ blob, audioTokens }` so callers can bill.
Returning a Blob keeps every caller's downstream (`concatenateAudioBlobs`, `blobToBase64`,
`arrayBuffer()` → `decodeAudioData`) unchanged.

**2b. Replace the five `/v1/audio/speech` call sites:**

| File | Lines (approx.) | Today | Change |
|---|---|---|---|
| `components/JamButton.tsx` | 475–526 | per-segment `gpt-4o-mini-tts` with `instructions` from Gemini style, then single-speaker `alloy` | `openaiSpeak({ text: segment.text, voice, style: instructions })`; the `instructions` string ("Speak in a X tone.") becomes the style suffix |
| `components/OneShotCreator.tsx` | 1503–1553 | same pattern | same |
| `components/ClassroomMode.tsx` | 53–59, 136–142 (`tts-1`, `nova`), 404, 538–562, 638–662 (`nova` / `onyx` by language) | narration | `openaiSpeak`; `nova` and `onyx` remain valid voices |
| `components/ClassroomMode.tsx` | 230, 2526–2540 | `narrationModel` state + `tts-1` / `gpt-4o-mini-tts` toggle | **Remove** — both options are dead; one model now |
| `utils/lexisTTS.ts` | 32–66 (`onyx`) | batch vocabulary audio | `openaiSpeak`; keep `onyx` |

Voice tables (`types.ts:92–103`, `utils/parser.ts:201–237` incl. the `nova`/`alloy` gender
defaults) need **no change** — every name there is accepted by `gpt-audio-1.5`.

**2c. Billing.** `server/index.js` TTS table (~line 703) is per-character. Add
`'tts:openai:gpt-audio-1.5': { perChar: 110 / 1_000_000 }` (≈ $0.09/min ÷ ~800 chars/min) and
log the model name from the helper. Better: send `audioTokens` from the helper and add a
token-priced entry (`perMillionAudioTokens: 64`) so the estimate stops drifting with speaking
rate. Token costs charged to teachers (`tokenCosts.ts`) assume Gemini succeeds; the OpenAI
fallback was already absorbed, so no change there unless fallback frequency is high — check
`UsageLog` for `provider: 'openai'` TTS rows before deciding.

**2d. Verify.** Force the Gemini path to fail (bad `VITE_GEMINI_API_KEY` locally) and run a Jam:
dialogue voices should match the speakers' Gemini-assigned styles and genders, segments should
concatenate cleanly, playback in StudentTest and ClassroomMode should work. Then: lexis audio from
the fullscreen button, EN and AR narration in ClassroomMode, and listen for any clip where the model
says more than the text (the fidelity warning should also show in the console).

### 2.5 As implemented — deviations, findings, and what's left

**Deviations from the plan above**

- **UI labels.** The plan recommended relabelling to "Fast" / "Premium". Instead "GPT-5 Mini" became
  **"GPT-5.6 Luna"** and "GPT-5.2" is unchanged, so a teacher can still see which model is
  running. If the fast model changes again, three label strings change with it (`HomePage.tsx`,
  `JamButton.tsx` `MODEL_CONFIG`, `Settings.tsx` ×2).
- **USD logging.** Usage rows keep logging the *internal* key (`gpt-5-mini`), not the API name as
  §2.2 1d assumed. So `llm:openai:gpt-5-mini` in `server/index.js` was repriced to luna's $0.20
  (luna and terra entries were also added). This means old and new rows can't be told apart by
  model name; the date (3 Oct 2026) separates them.
- **`reasoningFor()`** maps `'none'` to `'minimal'` for the *original* gpt-5 family. Testing found
  that `gpt-5-mini` returns HTTP 400 for `'none'`, which would bite anyone who points
  `VITE_OPENAI_FAST_MODEL` back at it. Non-reasoning models (`gpt-4o-mini`) get no `reasoning` field.
- **ClassroomMode click-to-pronounce** (`speakWord`, `speakWordSilent`, and the slide pre-generator
  that voices every word) was missing from the §2.3 table. It now uses `openaiSpeak` too. It was
  the riskiest input for a chat model, but single English words, a question word ("Why?") and
  Arabic words were all read correctly on the first attempt. Each click costs ≈ $0.001 and takes
  1–2 s, versus ≈ 1 s on tts-1.
- **Speech billing** uses the per-character estimate (`tts:openai:gpt-audio-1.5` at $90 / 1M chars,
  measured), not audio tokens. This is simpler, and the teacher-facing token costs are unchanged.

**Measured during implementation** (through the app's real modules, loaded with Vite's SSR loader)

| Check | Result |
|---|---|
| Jam listening, `gpt-5-mini` vs `gpt-5.6-luna`, reasoning on | Both: valid JSON, voice assignments match speakers, 4 Q / 4–5 lexis / 2 preview / 10 bonus, every correct answer within its options. Luna Call 2: 32 s and 512 reasoning tokens, vs 57 s and 3,456 |
| Jam reading, luna, reasoning off | Valid; 0 reasoning tokens on both calls |
| Shared `callOpenAI` with internal key; `resolveGender` on `gpt-4o-mini` | Work |
| Dialogue quality, side by side | Luna's dialogue is as natural or more so (hesitations, a self-correction) |
| `openaiSpeak`: an English word, "Why?", an Arabic word, a dialogue line, Arabic narration, the full lexis script | All read verbatim on the first try (no fidelity retries), all valid mp3 |
| Full OpenAI fallback for an 8-line dialogue (Maya→coral, Leo→fable) | 22 s total, 457 KB, 0 warnings |
| `generateLexisAudio()` | Returns an `engine: 'openai'` mp3 data URL |
| TypeScript | Same 9 pre-existing errors before and after |

**Still to check by hand, in a browser**

1. Joining segments uses `AudioContext.decodeAudioData`, which only runs in a browser. The mp3s
   are standard (ID3 header), but no test has joined them yet. Force the Gemini path to fail and run
   a listening Jam, then play the result in StudentTest and ClassroomMode.
2. Listen to a few clips. The tests verified the *words*, not the tone. The voices are the same
   names as before but come from a different model.
3. In ClassroomMode, play EN and AR narration, the lexis "Vocab" button, and click a few words.

**Found during testing, not fixed (unrelated to the migration).** In reading mode, Jam reuses the
listening question prompt (`buildTestContentPrompt`), so questions refer to "the dialogue" when
the content is a reading passage. gpt-5-mini shows the same behaviour.

### 2.4 Not on the deadline, but exposed by this work

- **API keys in the browser.** `VITE_OPENAI_API_KEY`, `VITE_ANTHROPIC_API_KEY`,
  `VITE_GEMINI_API_KEY`, `VITE_ELEVENLABS_API_KEY` ship in the bundle. Speech staying client-side
  (decision above) does not make this worse, but it does not fix it. Textbook extraction already
  runs on the server (`POST /api/extract-textbook`); the same pattern can host the chat and speech
  helpers later. If and when that happens, the realtime speech route becomes viable too.
- **`claude-sonnet` missing from the server `content_model` enum** (§2.2 1d).
- **Stale USD pricing** in `server/index.js` (`gpt-5-mini` at 0.40; actual 0.25).
- **ElevenLabs as fallback instead of OpenAI** is a legitimate alternative (already integrated,
  similar per-minute price to `gpt-audio-1.5`). Not chosen only because it would change voice
  character mid-dialogue for teachers used to the current fallback; revisit if OpenAI speech
  pricing moves again.

---

## Appendix — how the numbers were obtained

Three throw-away Node scripts on 3 Oct 2026 (total spend ≈ $0.05), run against the production
OpenAI key, same 24-word dialogue line for all speech tests:

- **`gpt-audio-1.5`** × 4 (voices `coral`, `nova`, `verse` with the verbatim prompt; `marin` with a
  plain "reply helpfully" prompt as the control). First three: transcript == input, 143–164 audio
  tokens, 2.8–4.4 s, 64–70 KB mp3 (ID3 header confirmed). Control: the model answered the text (320
  audio tokens of reply).
- **`gpt-realtime-2.1-mini`** × 2 (`marin`: transcript == input, 144 audio + 60 reasoning tokens,
  7.2 s of PCM, 3.5 s; `nova`: rejected with the voice list quoted in §1.3).
- **`gpt-5.6-luna`** × 3 (`effort: none` / omitted / `low` → 0 / 142 / 37 reasoning tokens,
  3.0 / 3.6 / 1.9 s) and **`gpt-5.6-terra`** × 1 (`none`, 1.7 s). All four parsed as JSON with the
  requested keys.

Sources: [deprecations](https://developers.openai.com/api/docs/deprecations) ·
[pricing](https://developers.openai.com/api/docs/pricing) · model pages for
`gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5-mini`, `gpt-5-nano`, `gpt-audio-1.5`, `gpt-audio-mini`,
`gpt-realtime-2.1-mini` · [Chat Completions reference](https://developers.openai.com/api/docs/api-reference/chat/create)
(`audio.voice` / `audio.format` enums) · [reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) ·
[structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) ·
`C:\projects\ChaulkieClone\documentation\openai-voice-migration.md`.
