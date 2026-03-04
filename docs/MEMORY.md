# Vocalize MVP - Project Memory

> **Start here**: Read `docs/CHANGELOG.md` first — it's the comprehensive codebase guide covering full architecture, every component, every API endpoint, workflows, and recent changes. This memory file is a condensed quick-reference.

## App Overview
ESL/EFL teaching platform. Teachers create AI-powered listening/reading tests with TTS, vocab games, discussion questions. Students take tests via QR codes (unauthenticated). Admins manage accounts + token budgets.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express 5.2 + MongoDB/Mongoose + JWT auth
- **TTS**: Gemini (primary) → OpenAI gpt-4o-mini-tts (fallback) → ElevenLabs → Browser Speech API
- **LLM**: OpenAI GPT-5 Mini / GPT-5.2 via Responses API
- **Storage**: Cloudinary (audio), MongoDB (data)
- **Deploy**: Heroku (https://listening-test-generator-203bfe6d6da6.herokuapp.com/)

## Key Files
- `server/index.js` — All API routes, MongoDB schemas, auth middleware (~1400 lines)
- `App.tsx` — Main orchestrator: routing, views, TTS engines, settings (~2600 lines)
- `components/StudentTest.tsx` — 4-phase test flow: match → gapfill → preview → questions
- `components/ClassroomMode.tsx` — Teacher presenter: QR codes, student gallery (~3000 lines)
- `components/OneShotCreator.tsx` — Full test creator: transcript → TTS → questions
- `components/JamButton.tsx` — One-click random test generator (wraps OneShotCreator)
- `components/TestBuilder.tsx` — Manual test builder with question/lexis/preview editors
- `components/FollowUpQuestions.tsx` — Post-test Bloom's taxonomy discussion + AI evaluation
- `components/AdminPanel.tsx` — User CRUD, token grants, usage analytics
- `components/UsageCharts.tsx` — Recharts bar chart: daily/weekly/monthly token usage
- `utils/parser.ts` — Dialogue parsing, voice assignment, GEMINI↔OPENAI voice mapping
- `utils/jsonRepair.ts` — LLM JSON output repair (regex + AI fallback)
- `utils/tokenCosts.ts` — Token cost calculator by model/config
- `docs/CHANGELOG.md` — Comprehensive codebase guide + changelog (start here for full context)

## Deployment
- **Origin**: `git push origin master`
- **Heroku**: `git push heroku master`
- Heroku dynos sleep after 30min; cold starts take 10-30s
- Pre-fetch data early to avoid cold start penalty

## Key Patterns & Lessons

### React: Never define components inside render body
Creates new function reference every render → React unmounts/remounts → kills mobile keyboards. Always define at module scope or use `useMemo`.

### TTS Fallback Chain
Gemini → OpenAI (style-matched via GEMINI_TO_OPENAI table, 30 voices) → ElevenLabs → Browser. `resolveGender()` LLM fallback for unknown speaker gender. Case-insensitive speaker lookups.

### Student Test Flow (QR Code)
1. QR URL: `{origin}?student-test={testId}&pt={teacherId}`
2. App.tsx extracts params → fetches test + teacher's theme
3. 4 phases: lexis match → gapfill → preview warmup → comprehension questions
4. Discussion: AI follow-up questions → AI evaluates answers
5. Student LLM calls billed to presenter teacher via `pt` param
6. Session persisted to sessionStorage (survives tab suspension)

### Token Billing
Atomic MongoDB `$inc` with `$lt` guard prevents overdraft. Student ops: fire-and-forget billing via presenter ID. Admin: unlimited but logged.

### OpenAI Responses API
- Endpoint: `POST https://api.openai.com/v1/responses`
- Optional `reasoning: { effort: 'low' | 'medium' | 'high' }`
- Discussion generation: no reasoning (speed); evaluation: low reasoning (quality)

### Student Dark Mode
Students aren't logged in → settingsHook returns default 'light'. Fixed: public `GET /api/teacher/:id/theme` endpoint + `presenterThemeLoaded` loading gate prevents flash.

### Pre-existing TypeScript Errors
- `TestBuilder.tsx:291` — CEFRLevel type issue
- `useAudioStorage.ts` — arithmetic type errors
- Known issues, not from our changes

## User Preferences
- User gets frustrated when changes don't match instructions — read carefully
- Prefers plan mode for non-trivial changes with edge case analysis
- Wants comprehensive documentation for LLM context continuity
