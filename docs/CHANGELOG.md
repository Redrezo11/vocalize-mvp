# Changelog

Recent development changes, organized by feature area. For an LLM reading this codebase: start here to understand what was built, what files were touched, and the architectural decisions made.

---

## 2026-03-04

### Student Dark Mode Fix (`18d57f3`)

**Bug**: Teacher sets night mode, student scans QR code, sees light mode instead.

**Root cause**: `App.tsx` passed `settingsHook.settings.classroomTheme` to StudentTest, but students aren't logged in so `settingsHook` returns the default `'light'`.

**Fix**:
- New public endpoint `GET /api/teacher/:id/theme` returns just `{ classroomTheme }` (no auth required)
- `App.tsx` fetches the presenter teacher's theme using the existing `?pt=` URL param
- Loading gate (`presenterThemeLoaded`) prevents flash of wrong theme
- Preview mode still uses the teacher's own local settings

**Files**: `server/index.js`, `App.tsx`

---

### Usage Analytics Charts (`d7c35b6`, `f4d1f96`, `a140e91`)

**Feature**: Admin panel Usage tab now shows interactive token usage charts (was all-time tables only).

**What was built**:
- `GET /api/admin/usage/timeseries` endpoint with `granularity` (daily/weekly/monthly), `days`, `userId` params
- Weekly grouping uses `$isoDayOfWeek` to compute Monday of each ISO week
- `UsageCharts` component using Recharts — bar chart with granularity toggle + date range presets
- User dropdown filter (All Users / specific user)
- Zero-fills missing dates for continuous x-axis
- Added `{ created_at: -1 }` index on UsageLog for efficient timeseries queries
- Date filtering (`startDate`, `endDate`) added to existing `/api/admin/usage` endpoint
- Removed "By Operation" and "By Provider/Model" detail tables from default view (kept per-user summary)

**Files**: `server/index.js`, `components/UsageCharts.tsx` (new), `components/AdminPanel.tsx`, `package.json` (added `recharts`)

---

### OpenAI TTS Fallback Voice Mapping (`f585453`, `4b2fa00`)

**Bug**: When Gemini TTS fails and falls back to OpenAI, male characters (e.g., "Marcus") were rendered with female voices.

**Root causes**:
1. `generateOpenAIAudio()` discarded Gemini voice assignments and re-guessed gender from names
2. Unknown names returned `Neutral` from `guessGender()` and could get female voices via alternation
3. `tts-1` model doesn't support `ballad`/`verse` voices

**Fix**:
- Style-matched `GEMINI_TO_OPENAI` lookup table (30 Gemini voices mapped to 11 OpenAI voices by tone/style)
- `mapGeminiToOpenAIVoices()` preserves gender with duplicate avoidance
- `resolveGender()` with LLM fallback (calls `gpt-4o-mini`) for unknown names
- `assignOpenAIVoicesAsync()` for when no Gemini mapping exists
- Upgraded fallback model from `tts-1` to `gpt-4o-mini-tts` (supports all 11 voices + style `instructions`)
- Reclassified `alloy` from Neutral to Male in `types.ts`
- Case-insensitive speaker name lookups (`voiceLookup`, `geminiLookup`) to handle LLM casing inconsistencies

**Files**: `utils/parser.ts`, `components/JamButton.tsx`, `components/OneShotCreator.tsx`, `types.ts`, `utils/tokenCosts.ts`, `docs/VOICE_ASSIGNMENT_GUIDE.md`

---

### JamButton Stuck at 0% Fix (`0de4765`)

**Bug**: Authenticated users clicking JamButton saw 0% progress forever.

**Root cause**: The `autoStart` render path returned early before the `TokenConfirmDialog`, so the confirm dialog never appeared and `handleJam` never ran.

**Fix**: Moved `TokenConfirmDialog` above the early return. Added `onCancel` prop so cancelling closes the modal cleanly.

**Files**: `components/JamButton.tsx`

---

### Token Billing System (`e187fef`, `b3302f9`, `4f8d94e`, `33466b2`, `647924f`)

**Feature**: Full token-based billing with per-user settings, student tracking, and admin analytics.

**What was built**:
- `token_balance`, `token_limit`, `tokens_used` fields on User schema
- `UsageLog` schema (append-only ledger) — tracks `user_id`, `operation`, `tokens_used`, `provider`, `model`, `metadata`, `created_at`
- `deductTokens()` utility with atomic MongoDB deduction (admins: increment only, teachers: balance check + deduct)
- API routes: `POST /api/tokens/use`, `POST /api/tokens/student-use`, `GET /api/tokens/balance`, `PUT /api/admin/users/:id/tokens`
- `GET /api/admin/usage` with aggregated analytics (by user, operation, provider)
- Token balance badge in nav header
- `TokenConfirmDialog` for all token-consuming operations
- Student LLM calls (discussion gen/eval, bonus questions) bill the presenting teacher via `?pt=` param
- Per-user settings stored in User schema (migrated from global singleton)
- Variable token cost matrix in `utils/tokenCosts.ts`

**Files**: `server/index.js`, `App.tsx`, `types.ts`, `contexts/AuthContext.tsx`, `hooks/useSettings.ts`, `utils/tokenCosts.ts`, `components/AdminPanel.tsx`, `components/JamButton.tsx`, `components/OneShotCreator.tsx`, `components/StudentTest.tsx`, `components/Settings.tsx`, `components/Navbar.tsx`

---

### Auth Session Recovery (`a3a35cc`)

**Feature**: Robust session handling for tab restore and JSON parsing.

- Auth: `checkSession` tries refresh token if access token expired on mount
- Auth: `visibilitychange` listener refreshes tokens when tab restored from background
- JSON repair utility with hardcoded fixes (trailing commas, comments, etc.)
- LLM repair fallback with "Fixing JSON with AI..." stage for OneShotCreator
- Fix `onUpdateTest` storing unmapped MongoDB fields (broke ClassroomMode)

**Files**: `contexts/AuthContext.tsx`, `utils/jsonRepair.ts` (new), `components/OneShotCreator.tsx`, `components/TestBuilder.tsx`, `helpers/bonusGeneration.ts`

---

### Admin Panel UX (`f325e67` through `ee60af1`)

- Show/hide password toggles on admin forms
- Disable browser autofill on add-user form
- Username/role aligned left in user list and forms
- CEFR difficulty badge + creator name on test cards, audio cards, and ClassroomMode cards
- `created_by` populated with user details in `GET /api/tests`

**Files**: `components/AdminPanel.tsx`, `components/AudioLibrary.tsx`, `components/ClassroomMode.tsx`, `server/index.js`, `types.ts`

---

## Architecture Notes (for LLMs)

### Key File Map

| File | Purpose |
|------|---------|
| `server/index.js` | Express server — all API routes, MongoDB schemas, auth middleware |
| `App.tsx` | Main React app — routing, view state machine, settings, audio engines |
| `types.ts` | TypeScript types — ListeningTest, voice configs, TTS engine types |
| `components/StudentTest.tsx` | Student test-taking flow — phases, audio playback, question answering |
| `components/JamButton.tsx` | "JAM" one-click test generator — TTS, LLM, bonus questions |
| `components/OneShotCreator.tsx` | Full test creator — transcript generation, TTS, question generation |
| `components/ClassroomMode.tsx` | Teacher classroom view — test selection, QR codes, presentation |
| `components/AdminPanel.tsx` | Admin panel — user management, token grants, usage analytics |
| `components/Settings.tsx` | User settings — app mode, theme, difficulty, model selection |
| `utils/parser.ts` | Dialogue parsing, voice assignment, gender resolution |
| `utils/tokenCosts.ts` | Token cost calculator — variable rates by model/config |
| `contexts/AuthContext.tsx` | Auth context — login, refresh, token balance tracking |
| `hooks/useSettings.ts` | Per-user settings hook — loads/saves from `/api/settings` |

### Data Flow: Teacher → Student

1. Teacher creates test → saved to MongoDB (`ListeningTest` collection)
2. Teacher enters ClassroomMode → selects test → generates QR code
3. QR URL: `{origin}?student-test={testId}&pt={teacherId}`
4. Student scans → `App.tsx` extracts params → fetches test from `/api/tests/:id`
5. Student's theme fetched from `/api/teacher/:id/theme` using `pt` param
6. `StudentTest` component renders with test data + teacher's theme
7. Student LLM calls (bonus questions, discussion) bill the teacher via `pt` param

### Token Billing Flow

1. Frontend calls `reportTokenUsage()` or `reportStudentTokenUsage()` from `utils/tokenApi.ts`
2. Server's `deductTokens()` atomically deducts from user balance + logs to `UsageLog`
3. Admin sees usage in Admin Panel → Usage tab (charts + per-user table)
