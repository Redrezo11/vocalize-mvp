# Vocalize MVP — Codebase Guide & Changelog

For any LLM reading this codebase: start here. This document covers the full application architecture, every component, every API endpoint, key workflows, and a detailed changelog of recent development.

---

## What Is This App?

**Vocalize** (internal name: DialogueForge) is a full-stack web app for ESL/EFL teachers and students. Teachers generate AI-powered listening and reading comprehension tests with integrated TTS (text-to-speech), vocabulary practice, discussion questions, and classroom presentation modes. Students take tests via QR codes on their phones.

**Users**: Teachers (create tests, present in class), Students (take tests via QR code, unauthenticated), Admins (manage teacher accounts, token budgets, analytics)

**Tech Stack**: React 19 + TypeScript + Vite + Tailwind CSS | Express 5.2 + MongoDB/Mongoose + JWT | TTS: Browser, Gemini, ElevenLabs, OpenAI | LLM: OpenAI GPT-5 Mini / GPT-5.2 | Storage: Cloudinary (audio), MongoDB (data) | Deploy: Heroku

---

## Key File Map

| File | Purpose |
|------|---------|
| `server/index.js` | Express server — all API routes, MongoDB schemas, auth middleware (~1400 lines) |
| `App.tsx` | Main React orchestrator — routing, view state machine, TTS engines, settings (~2600 lines) |
| `types.ts` | TypeScript types — ListeningTest, voice configs, TTS engine types (~340 lines) |
| `components/StudentTest.tsx` | Student test flow — 4-phase: match → gapfill → preview → questions (~1200 lines) |
| `components/JamButton.tsx` | "JAM" one-click test generator (~1200 lines) |
| `components/OneShotCreator.tsx` | Full test creator — transcript + TTS + questions (~1500 lines) |
| `components/ClassroomMode.tsx` | Teacher classroom view — QR codes, student gallery, presentation (~3000 lines) |
| `components/TestBuilder.tsx` | Manual test builder — questions, lexis, preview activities (~2000 lines) |
| `components/AdminPanel.tsx` | Admin — user management, token grants, usage charts (~600 lines) |
| `components/Settings.tsx` | User settings — mode, theme, difficulty, model (~600 lines) |
| `components/FollowUpQuestions.tsx` | Post-test discussion with AI evaluation (~1000 lines) |
| `components/HomePage.tsx` | Landing page — creation method selector (~400 lines) |
| `components/AudioLibrary.tsx` | Library — audio, transcripts, tests tabs (~500 lines) |
| `components/PromptBuilder.tsx` | LLM transcript generation from prompts (~1200 lines) |
| `utils/parser.ts` | Dialogue parsing, voice assignment, gender resolution (~320 lines) |
| `utils/tokenCosts.ts` | Token cost calculator — variable rates by model/config |
| `utils/lexisTTS.ts` | Vocabulary audio generation (per-word + batch) |
| `utils/eflTopics.ts` | 100+ EFL topics + format configs for JAM generation |
| `utils/readingTopics.ts` | 100+ reading topics + genre configs |
| `utils/jsonRepair.ts` | LLM JSON output repair (regex + AI fallback) |
| `utils/tokenApi.ts` | Client-side token deduction helpers |
| `contexts/AuthContext.tsx` | Auth state — login, refresh, token balance |
| `hooks/useSettings.ts` | Per-user settings persistence |
| `hooks/useGeminiTTS.ts` | Gemini TTS integration with quota tracking |
| `hooks/useBrowserTTS.ts` | Web Speech API wrapper |
| `hooks/useElevenLabsTTS.ts` | ElevenLabs API integration |
| `hooks/useMongoStorage.ts` | CRUD for saved audio entries |
| `hooks/usePinchZoom.ts` | Touch pinch-to-zoom gesture handler |
| `helpers/bonusGeneration.ts` | Fire-and-forget bonus question generation |

---

## Components — What Each One Does

### Page-Level

| Component | What it does |
|-----------|-------------|
| **HomePage** | 5 creation methods: Audio Upload, Transcript Editor, Document Import, OneShot Generator, JAM Button. Difficulty/mode/duration/model selectors. |
| **AudioLibrary** | 3 tabs (Audio, Transcripts, Tests). Search/filter, edit/delete/duplicate, create test from audio. |
| **AudioDetail** | Audio waveform, play controls, speaker voice assignment UI, lexis TTS preview, save to library. |
| **TestBuilder** | Multi-step: question generation (LLM or manual), lexis editor, preview activities, classroom activity, transfer question, bonus questions. |
| **OneShotCreator** | One-click full test: LLM transcript → TTS audio → questions → lexis → bonus. JSON repair fallback. Multi-stage progress. |
| **JamButton** | Quick generation with minimal input. Random topic/format/speakers. Wraps OneShotCreator. |
| **ClassroomMode** | Teacher presenter view: test selection, QR code generation, student gallery, synchronized timer, per-student messaging. Dark theme support. |
| **StudentTest** | 4-phase test (match → gapfill → preview → questions), discussion phase, session persistence, zoom, fullscreen, wake lock. |
| **FollowUpQuestions** | Post-test Bloom's taxonomy discussion (Connect/Compare/Judge). AI evaluation with student context. EN/AR bilingual. |
| **TranscriptMode** | Text-only view of dialogue/passage (reading tests or fallback). |
| **AdminPanel** | User CRUD, token grants ($1/$2/$5 presets), usage analytics charts (Recharts), per-user summary table. |
| **Settings** | App mode (listening/reading), CEFR level, content mode (standard/halal/ELSD), theme (light/dark), duration, model, speaker count. |
| **LoginPage** | Username/password login. |

### Vocabulary Games (used inside StudentTest)

| Component | What it does |
|-----------|-------------|
| **LexisMatchGame** | Drag-n-drop: English term ↔ Arabic definition. Audio playback on match. |
| **LexisGapFillGame** | Fill blanks in example sentences. Multiple-choice per blank. Hints + explanations. |

### Preview Activities (pre-test warmup, used inside StudentTest)

| Component | What it does |
|-----------|-------------|
| **PreviewPhase** | Routes to correct activity component based on type. |
| **PredictionActivity** | Opinion/prediction warmup questions (no correct answer). |
| **WordAssociationActivity** | "Which words appear in the dialogue?" toggle selection. |
| **TrueFalseActivity** | True/false statements about content. |

### Supporting

| Component | What it does |
|-----------|-------------|
| **UsageCharts** | Recharts bar chart — daily/weekly/monthly token usage with user filter. |
| **TokenConfirmDialog** | Confirm token cost before generation. |
| **SaveDialog** | Save/update dialog for audio entries. |
| **FloatingZoomWidget** | Pinch-zoom controls for passage reading. |
| **Icons** | 30+ SVG icons. |
| **ImportWizard** | Document upload (PDF/DOCX/TXT) with format detection. |
| **DocumentImport** | File parser helper (Mammoth, pdf-parse, plain text). |

---

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/login` | POST | - | Username/password → JWT cookies |
| `/api/auth/refresh` | POST | - | Rotate access + refresh tokens |
| `/api/auth/logout` | POST | - | Invalidate refresh token |
| `/api/auth/me` | GET | Yes | Current user info |
| `/api/audio-entries` | GET | Yes | List all audio entries |
| `/api/audio-entries` | POST | Yes | Create audio (Cloudinary upload) |
| `/api/audio-entries/:id` | GET | - | Get one audio (public) |
| `/api/audio-entries/:id` | PUT | Yes | Update audio (owner/admin) |
| `/api/audio-entries/:id` | DELETE | Yes | Delete audio + Cloudinary cleanup |
| `/api/listening-tests` | GET | Yes | List all tests |
| `/api/listening-tests` | POST | Yes | Create test (uploads audio blobs) |
| `/api/listening-tests/:id` | GET | - | Get one test (public, for students) |
| `/api/listening-tests/:id` | PUT | Yes | Update test (owner/admin) |
| `/api/listening-tests/:id` | DELETE | Yes | Delete test + Cloudinary cleanup |
| `/api/tokens/balance` | GET | Yes | User's token balance |
| `/api/tokens/use` | POST | Yes | Deduct tokens (atomic, returns 402 if insufficient) |
| `/api/tokens/student-use` | POST | - | Bill presenter teacher (fire-and-forget) |
| `/api/teacher/:id/theme` | GET | - | Teacher's classroom theme (public) |
| `/api/settings` | GET | Yes | User's settings |
| `/api/settings` | PUT | Yes | Update settings |
| `/api/upload-document` | POST | Yes | Parse PDF/DOCX/TXT |
| `/api/admin/users` | GET | Admin | List users |
| `/api/admin/users` | POST | Admin | Create teacher |
| `/api/admin/users/:id` | PUT | Admin | Update user |
| `/api/admin/users/:id` | DELETE | Admin | Delete user |
| `/api/admin/users/:id/tokens` | PUT | Admin | Set token balance/limit |
| `/api/admin/usage` | GET | Admin | Aggregated usage (by user, operation, provider) |
| `/api/admin/usage/timeseries` | GET | Admin | Time-series usage (daily/weekly/monthly) |
| `/api/admin/migrate-plenary-audio` | POST | Admin | One-time base64→Cloudinary migration |
| `/api/admin/migrate-token-usage` | POST | Admin | Sync admin tokens_used from UsageLog |

---

## MongoDB Schemas

| Collection | Key Fields |
|------------|-----------|
| **User** | username, password_hash, name, role (admin/teacher), is_active, token_balance, token_limit, tokens_used, refresh_token, settings (app_mode, difficulty, content_mode, classroom_theme, target_duration, content_model, default_speaker_count) |
| **AudioEntry** | title, transcript, audio_url, engine, speaker_mapping, speakers, is_transcript_only, difficulty, created_by |
| **ListeningTest** | audioId, title, type, questions[], lexis[], lexisAudio, preview[], classroomActivity, transferQuestion, speakerCount, sourceText, difficulty, bonusQuestions, created_by |
| **UsageLog** | user_id, operation, tokens_used, provider, model, metadata, created_at. Indexes: `{user_id, created_at}`, `{created_at}` |

---

## Core Workflows

### Student Takes a Test (QR Code Flow)
1. Teacher opens ClassroomMode → selects test → generates QR code
2. QR URL: `{origin}?student-test={testId}&pt={teacherId}`
3. Student scans → App.tsx extracts params → fetches test + teacher's theme
4. StudentTest mounts: pre-fetches transcript (cold start optimization)
5. 4-phase test: lexis match → lexis gapfill → preview warmup → comprehension questions
6. Discussion phase: AI-generated follow-up questions → AI evaluates student answers
7. Session persisted to sessionStorage (survives mobile tab suspension)
8. Student LLM calls bill the presenting teacher via `pt` param

### Teacher Creates a Test (JAM Flow)
1. Teacher clicks JAM → selects topic/format/difficulty/model
2. Token cost confirmation dialog
3. OneShotCreator: LLM generates transcript → parse speakers → assign voices → generate TTS audio → upload to Cloudinary → create test with questions/lexis/preview → fire-and-forget 10 bonus questions
4. Test saved to MongoDB, available in library and ClassroomMode

### Token Billing
1. Frontend checks `hasEnoughTokens()` → shows `TokenConfirmDialog`
2. On confirm: `POST /api/tokens/use` → atomic balance deduction + UsageLog entry
3. Student operations: `POST /api/tokens/student-use` → bills presenter (fire-and-forget, never blocks student)
4. Admin: unlimited usage (still logged for analytics)
5. Costs: 5-21 tokens per JAM generation (varies by model + reasoning + speakers). Reading mode halves cost.

### TTS Engine Fallback Chain
1. Primary: Gemini TTS (best quality, quota-limited)
2. Fallback: OpenAI `gpt-4o-mini-tts` (style-matched voice mapping via `GEMINI_TO_OPENAI` table)
3. Alternative: ElevenLabs (user-selectable)
4. Last resort: Browser Web Speech API

### Voice Assignment
1. LLM generates `VOICE_ASSIGNMENTS` section mapping speakers to Gemini voices
2. `parseLLMTranscript()` extracts voice assignments
3. If Gemini fails → `mapGeminiToOpenAIVoices()` converts to style-matched OpenAI voices
4. Unknown speaker gender → `resolveGender()` calls `gpt-4o-mini` as LLM fallback
5. Case-insensitive lookups prevent casing mismatches between LLM sections

---

## State Management

| Scope | Where | What |
|-------|-------|------|
| **Global** | `App.tsx` | currentView, selectedAudio, selectedTest, allTests, studentTest, presenterTeacherId, presenterTheme |
| **Auth** | `AuthContext` | user, login(), logout(), updateTokenBalance() |
| **Settings** | `useSettings` hook | appMode, difficulty, classroomTheme, contentModel, etc. |
| **Session** | sessionStorage | `df_currentView`, `df_studentTestId`, `df_presenterTeacherId`, `st_{testId}` (test session), `st_{testId}_disc` (discussion session), `df_fullTestCache` |

---

## Key Patterns

- **Lazy loading**: All large components loaded via `React.lazy()` with Suspense boundaries
- **Session persistence**: sessionStorage + fullTestCache survives mobile tab kill
- **Token billing**: Atomic MongoDB `$inc` with `$lt` guard prevents overdraft
- **LLM resilience**: `jsonRepair.ts` catches malformed JSON from LLM, retries with AI repair
- **Voice mapping**: Gender-aware GEMINI↔OPENAI lookup table with duplicate avoidance
- **Pre-fetch optimization**: Transcript loaded on StudentTest mount to avoid cold-start TTS penalty
- **Bilingual**: All student-facing content supports EN/AR with language toggle
- **Never define components inside render**: Causes React unmount/remount → kills mobile keyboards (lesson learned)

---

## Recent Changes (2026-03-05)

### Gateway Page Labels & Color Consistency (`f1df117`)

**Feature**: Gateway landing page now reflects the current app mode.

- Left card label: "Create" → **"Create Listening"** / **"Create Reading"** based on `appMode`
- Left card color: **green/emerald** in reading mode (icon, shadow, hover) instead of always blue/indigo
- Right card label: "Present Test" → **"Present Lesson"**

**Files**: `App.tsx`

---

### Bonus Questions Race Condition Fix (`371e92b`)

**Bug**: Student clicks +5 bonus questions, request fails ("Failed to fetch"), clicks again 2 more times → 3 question sets dumped at once. Caused duplicate or unwanted extra rounds.

**Root cause**: `setIsGeneratingBonus(true)` was called *after* the pool fetch `await` (not at the top), leaving buttons clickable for seconds during Heroku cold start. No ref-based guard against concurrent invocations. Case 1 (instant pool serve) never set loading state at all.

**Fix**:
- Added `isBonusInFlightRef` (synchronous, closure-proof concurrency guard)
- Moved `setIsGeneratingBonus(true)` to the very first line, before any `await`
- Restructured into single outer `try/finally` — guarantees cleanup regardless of case
- Added `disabled={isGeneratingBonus}` + disabled styling to all 4 bonus buttons as secondary protection

**Files**: `components/StudentTest.tsx`

---

### Classroom Mode Edit Restriction (`da91838`)

**Feature**: Teachers can only see edit/delete icons on their own tests in classroom mode. Admins can edit any test.

**Fix**: Added `(user?.role === 'admin' || user?.username === test.createdBy?.username)` guard to the edit button, matching the existing delete button pattern.

**Files**: `components/ClassroomMode.tsx`

---

### Bonus Pool Tracking Fix — `_id` vs `id` (`82d19f8`)

**Bug**: Clicking +5 bonus questions works, but clicking +5 again shows the same questions. SessionStorage dedup didn't work.

**Root cause**: `testQuestionSchema` has no custom `id` field — MongoDB subdocuments only get `_id`. When tracking seen questions via `q.id`, it was always `undefined`, so `seenSet.has(undefined)` returned false and every question looked unseen.

**Fix**: Added `qid()` helper: `(q) => q._id || q.id || q.questionText`. Used consistently in all filtering and `markSeen` calls. Changed `seenIds` from `const` to `let` for proper accumulation.

**Files**: `components/StudentTest.tsx`

---

### Bonus Questions — LLM Prompts + Shared Append-Only Pool (`b3bfcc5`)

**Feature**: Complete bonus questions system — pre-generated at test creation + shared pool for students.

**Part A — LLM Prompt Templates**: Added `bonusQuestions` (10 questions) to JSON output format in all prompt builders:
- `TestBuilder.tsx` — `getLLMTemplate` (listening & reading comprehension)
- `OneShotCreator.tsx` — single-call prompt, `buildTestContentPrompt`, `buildPassagePrompt`
- Updated response parsing and test save payloads in OneShotCreator, JamButton, and TestBuilder
- Fire-and-forget `generateBonusForTest` now conditional — only runs when LLM didn't include bonus questions

**Part B — Shared Pool**:
- `GET /api/tests/:id/bonus-pool` — lightweight fetch of just bonus questions (no auth, for students)
- `POST /api/tests/:id/bonus-questions` — append-only (`$push` + `$each`), never replaces
- Rewrote `handleGenerateBonus` in `StudentTest.tsx`: fetch latest pool from DB → filter by sessionStorage seen IDs → serve from pool or generate live → append live questions back to DB
- Per-student tracking via sessionStorage (`bonus_seen_${testId}`)

**Files**: `components/TestBuilder.tsx`, `components/OneShotCreator.tsx`, `components/JamButton.tsx`, `server/index.js`, `components/StudentTest.tsx`, `helpers/bonusGeneration.ts` (new)

---

### Reading Mode QR Code Bug Fix (`0c749ba`)

**Bug**: When a student scans a QR code for a reading test, the passage was missing.

**Fix**: Ensured `sourceText` (the reading passage) is properly passed to `StudentTest` for reading-mode tests.

**Files**: `App.tsx`, `components/StudentTest.tsx`

---

### Lexis Pause Button Color Fix (`7495bf4`)

**Bug**: Fullscreen lexis pause button was amber instead of green.

**Fix**: Changed pause button color to match green play button styling for consistency.

**Files**: `components/ClassroomMode.tsx`

---

### Gateway Landing Page + Simplified Navbar (`a73b083`, `4b0ff00`)

**Feature**: New two-card gateway as the default landing page.

- **Create** card (left) → goes to creation method selector
- **Present** card (right) → enters classroom mode
- Simplified navbar: replaced multiple creation mode buttons with single "Create" button
- ReadForge branding + green accent in reading mode; DialogueForge + indigo in listening mode

**Files**: `App.tsx`

---

### Fullscreen Lexis Audio Button (`f50a8a6`)

**Feature**: Added "Generate Lexis Audio" button in fullscreen classroom view + clarified S key hint labels.

**Files**: `components/ClassroomMode.tsx`

---

### Classroom Test Filter Toggle (`efbc6fb`)

**Feature**: "All Tests" / "My Tests" toggle in classroom mode. Preference persisted in user settings.

**Files**: `components/ClassroomMode.tsx`, `hooks/useSettings.ts`, `server/index.js`

---

### Classroom Navigation Fixes (`6797442`, `1d46a13`, `b55f4a9`, `3a1cc6e`)

- Preview exit returns to classroom presentation view (not test list)
- Fixed TDZ crash: moved `userFiltered` memos after `audioStorage` declaration
- Fixed classroom redirect bug: excluded classroom from audio restore effect
- Fixed stale audio entries: refresh on ClassroomMode entry

**Files**: `App.tsx`, `components/ClassroomMode.tsx`

---

### Teacher Content Isolation + Reading Defaults (`eba22f5`)

**Feature**: Teachers see only their own content by default. Reading mode defaults to vocabulary view.

**Files**: `App.tsx`, `components/ClassroomMode.tsx`

---

### Classroom Keyboard & UI Polish (`5db85de`, `b90ffa4`, `941cc01`, `33263e8`)

- Restricted delete to admins + removed play/delete from audio cards in library
- Fixed Space key playing lexis audio instead of main listening audio
- Removed Esc button from non-fullscreen classroom footer
- Fixed S key lexis audio + clickable footer hints + Vocab button play/pause

**Files**: `components/ClassroomMode.tsx`, `components/AudioLibrary.tsx`

---

### Lexis Audio Simplification (`6e5ff78`)

**Feature**: Removed per-word lexis audio generation. Simplified to full-batch OpenAI TTS only (faster, cheaper).

**Files**: `utils/lexisTTS.ts`, `components/ClassroomMode.tsx`, `components/TestBuilder.tsx`

---

### Audio Persistence Fix (`7e8fbfc`)

**Bug**: Audio not persisting on test creation.

**Fix**: Server now processes base64 audio uploads on POST (create), not just PUT (update).

**Files**: `server/index.js`

---

## Earlier Changes (2026-03-04)

### Student Dark Mode Fix (`18d57f3`)

**Bug**: Teacher sets night mode, student scans QR code, sees light mode.

**Root cause**: `App.tsx` passed `settingsHook.settings.classroomTheme` to StudentTest — students aren't logged in, so settingsHook returns default `'light'`.

**Fix**: New public `GET /api/teacher/:id/theme` endpoint. App.tsx fetches presenter's theme using existing `?pt=` param. Loading gate prevents flash of wrong theme. Preview mode still uses teacher's own settings.

**Files**: `server/index.js`, `App.tsx`

---

### Usage Analytics Charts (`d7c35b6`, `f4d1f96`, `a140e91`)

**Feature**: Admin Usage tab — interactive token usage charts.

- `GET /api/admin/usage/timeseries` endpoint (daily/weekly/monthly granularity)
- Weekly grouping via `$isoDayOfWeek` (Monday start)
- `UsageCharts` component (Recharts) — bar chart + granularity toggle + date range presets + user filter
- Zero-fills missing dates for continuous x-axis
- `{ created_at: -1 }` index on UsageLog
- Removed "By Operation" / "By Provider" detail tables from default view

**Files**: `server/index.js`, `components/UsageCharts.tsx` (new), `components/AdminPanel.tsx`, `package.json`

---

### OpenAI TTS Fallback Voice Mapping (`f585453`, `4b2fa00`)

**Bug**: Gemini TTS fallback to OpenAI rendered male characters with female voices.

**Fix**: Style-matched `GEMINI_TO_OPENAI` lookup (30 voices). `mapGeminiToOpenAIVoices()` with duplicate avoidance. `resolveGender()` LLM fallback. Upgraded to `gpt-4o-mini-tts`. Reclassified `alloy` as Male. Case-insensitive speaker lookups.

**Files**: `utils/parser.ts`, `components/JamButton.tsx`, `components/OneShotCreator.tsx`, `types.ts`, `utils/tokenCosts.ts`

---

### JamButton Stuck at 0% (`0de4765`)

**Bug**: `autoStart` render path returned early before `TokenConfirmDialog`.

**Fix**: Moved dialog above early return. Added `onCancel` prop.

**Files**: `components/JamButton.tsx`

---

### Token Billing System (`e187fef`, `4f8d94e`, `33466b2`, `647924f`)

**Feature**: Full token billing — per-user balances, atomic deduction, student billing via presenter ID, admin analytics.

**Files**: `server/index.js`, `App.tsx`, `types.ts`, `contexts/AuthContext.tsx`, `hooks/useSettings.ts`, `utils/tokenCosts.ts`, `components/AdminPanel.tsx`, `components/JamButton.tsx`, `components/OneShotCreator.tsx`, `components/StudentTest.tsx`

---

### Auth Session Recovery (`a3a35cc`)

Refresh token on mount if expired. `visibilitychange` listener for tab restore. JSON repair utility with LLM fallback. Fixed `onUpdateTest` field mapping.

**Files**: `contexts/AuthContext.tsx`, `utils/jsonRepair.ts`, `components/OneShotCreator.tsx`, `components/TestBuilder.tsx`

---

### Admin Panel UX (`f325e67` through `ee60af1`)

Password toggle, autofill disabled, CEFR badges, creator names on cards.

**Files**: `components/AdminPanel.tsx`, `components/AudioLibrary.tsx`, `components/ClassroomMode.tsx`, `server/index.js`
