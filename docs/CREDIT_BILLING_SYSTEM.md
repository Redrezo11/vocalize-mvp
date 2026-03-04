# Credit/Token Billing System — Planning Guide

> **Status**: Research/planning phase. Subject to change.

## Model: Pre-paid Credits (Hybrid)

- Org-wide credit pool funded by admin + per-teacher monthly caps
- Abstract credits (not raw dollars) — insulates from provider price changes
- Outcome-based pricing: "1 test = 10 credits" over "1 credit = 1,000 characters"

## API Cost Analysis (March 2026)

### TTS Providers

| Provider | Model | Price | Unit |
|----------|-------|-------|------|
| OpenAI | tts-1 (standard) | $15.00 | per 1M chars |
| OpenAI | gpt-4o-mini-tts | ~$15.00 | per 1M chars |
| Gemini | gemini-2.5-flash-preview-tts | $0.50 in / $10.00 out | per 1M tokens |
| ElevenLabs | eleven_multilingual_v2 | $0.12-$0.30 | per 1K chars (overage) |

### LLM Providers (question gen / evaluation)

| Provider | Model | Input | Output | Unit |
|----------|-------|-------|--------|------|
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | per 1M tokens |
| OpenAI | gpt-4.1-nano | $0.10 | $0.40 | per 1M tokens |
| Anthropic | Claude Haiku 4.5 | $1.00 | $5.00 | per 1M tokens |

### Cost Per Operation (typical 300-word passage, 10 questions)

| Operation | Provider | Est. Cost |
|-----------|----------|-----------|
| Passage TTS (Gemini) | Gemini Flash TTS | $0.005-$0.015 |
| Passage TTS (OpenAI) | gpt-4o-mini-tts | ~$0.023 |
| Passage TTS (ElevenLabs) | eleven_multilingual_v2 | $0.18-$0.45 |
| Per-word lexis (10 words) | OpenAI tts-1 | ~$0.001 |
| Bonus question generation | OpenAI Responses API | ~$0.001 |
| Answer evaluation (10 Qs) | OpenAI Responses API | ~$0.005 |
| **Full test cycle** | **Combined (Gemini TTS)** | **$0.01-$0.05** |

**Key insight**: TTS is 90%+ of cost. Gemini Flash is cheapest. ElevenLabs is 10-20x more expensive.

## Credit Pricing (target ~40-50% margin)

| Operation | Raw Cost | Credits | ~$/credit |
|-----------|----------|---------|-----------|
| Full test with TTS | $0.02-$0.05 | 10 | $0.005 |
| Bonus questions only | $0.001 | 2 | $0.0005 |
| Regenerate TTS (passage) | $0.01-$0.02 | 5 | $0.004 |
| Per-word lexis pronunciation | $0.001 | 1 | $0.001 |
| Student answer evaluation | $0.005 | 3 | $0.0017 |

## Suggested Pricing Tiers

| Tier | Price | Credits/month | Use Case |
|------|-------|---------------|----------|
| Free | $0 | 100 (~10 tests) | Teacher evaluation, no CC required |
| Teacher | $25/mo | 5,000 (~500 tests) | Individual teacher |
| School | $100/mo | 25,000 | 10-20 active teachers |
| Enterprise | Custom | Custom | District-wide, annual contracts |

## Schema Design (MongoDB)

### User Schema (extend existing)

```
creditBalance: Number           // Current available credits
monthlyAllocation: Number       // Credits granted per month
monthlyCap: Number              // Max credits per month (set by admin)
monthlyUsed: Number             // Credits used this month
monthlyResetDate: Date          // When to reset monthlyUsed
```

### UsageLog (append-only ledger)

```
UsageLog {
  userId: ObjectId
  operation: String              // 'tts_passage' | 'tts_lexis' | 'question_gen' | 'evaluation'
  provider: String               // 'openai' | 'gemini' | 'elevenlabs'
  model: String
  creditsDeducted: Number
  rawCostUSD: Number             // Actual API cost for internal tracking
  metadata: {
    inputTokens, outputTokens, characterCount, testId, durationMs
  }
  timestamp: Date
  balanceAfter: Number           // Snapshot for audit
}
```

### CreditTransaction (top-ups, grants, refunds)

```
CreditTransaction {
  userId: ObjectId               // null for org-level
  type: String                   // 'purchase' | 'monthly_grant' | 'admin_adjustment' | 'refund'
  amount: Number                 // positive = credit, negative = debit
  balanceAfter: Number
  note: String
  performedBy: ObjectId
  timestamp: Date
}
```

## Implementation Pattern

1. **estimateCredits(req)** — calculate credits from request params (char count, etc.)
2. **checkBalance(userId, est)** — reject with 402 if insufficient
3. **reserveCredits(userId, est)** — atomic `findOneAndUpdate` with `$inc` and `$gte` condition
4. **executeAPICall()** — make the actual provider call
5. **On success**: log usage, adjust if estimate != actual
6. **On failure**: refund reserved credits atomically

## Variable Token Costs by Permutation (Phase 2 Reference)

Token deduction uses **variable rates** based on the exact configuration chosen by the teacher.

### LLM Cost Variables

| Model | Reasoning | Est. Cost/Call | Token Multiplier |
|-------|-----------|---------------|-----------------|
| gpt-5-mini | None | <$0.001 | 1x (base) |
| gpt-5-mini | Low | ~$0.001 | 1x |
| gpt-5.2 | None | ~$0.005 | 3x |
| gpt-5.2 | Low | ~$0.008 | 5x |
| gpt-5.2 | Medium | ~$0.012 | 7x |

### TTS Cost Variables

| Engine | Model | Cost per call | Token Multiplier |
|--------|-------|--------------|-----------------|
| Gemini | gemini-2.5-flash-preview-tts | ~$0.005-0.015 | 1x (base) |
| OpenAI | tts-1 / gpt-4o-mini-tts | ~$0.015-0.023 | 2x |
| ElevenLabs | eleven_multilingual_v2 | ~$0.18-0.45 | 10x |

### Speaker Count Impact (TTS)

| Speakers | TTS Calls | Notes |
|----------|-----------|-------|
| 1 (monologue) | 1 | Single call for full passage |
| 2 (dialogue) | 2 | One per speaker |
| 3+ (multi) | 3-4 | One per speaker; Gemini max 2 speakers |

### Full JAM/OneShot Generation — Token Matrix

| Config | LLM Calls | Reasoning | TTS (spk) | Lexis | Est. Cost | Tokens |
|--------|-----------|-----------|-----------|-------|-----------|--------|
| mini, no reasoning, 1 spk | 2+bonus | none | 1 | batch | ~$0.005 | **5** |
| mini, no reasoning, 2 spk | 2+bonus | none | 2 | batch | ~$0.008 | **7** |
| mini, reasoning, 2 spk | 2+bonus | low+med | 2 | per-word(8) | ~$0.01 | **10** |
| 5.2, no reasoning, 1 spk | 2+bonus | none | 1 | batch | ~$0.015 | **12** |
| 5.2, no reasoning, 2 spk | 2+bonus | none | 2 | batch | ~$0.018 | **14** |
| 5.2, reasoning, 2 spk | 2+bonus | low+med | 2 | per-word(8) | ~$0.03 | **20** |
| 5.2, reasoning, 3 spk | 2+bonus | low+med | 3 | per-word(10) | ~$0.04 | **25** |

### Student Test Operations

| Operation | Model | Reasoning | Est. Cost | Tokens |
|-----------|-------|-----------|-----------|--------|
| Discussion questions (generate) | mini | none | <$0.001 | **1** |
| Discussion questions (generate) | 5.2 | none | ~$0.005 | **3** |
| Answer evaluation | mini | low | ~$0.001 | **1** |
| Answer evaluation | 5.2 | low | ~$0.008 | **5** |
| Bonus practice round | mini | none | <$0.001 | **1** |
| Bonus practice round | 5.2 | none | ~$0.003 | **2** |

### Other Operations

| Operation | Est. Cost | Tokens |
|-----------|-----------|--------|
| Lexis audio (full batch, 1 TTS call) | ~$0.002 | **2** |
| Per-word pronunciation (1 word, cached) | ~$0.001 | **1** |
| Classroom session (typical 10 words) | ~$0.01 | **5** |

### Duration Impact on Content Volume

| Duration | Word Count | Questions | Lexis Items |
|----------|-----------|-----------|-------------|
| 5 min | 80-120 | 3-4 | 3-5 |
| 10 min | 180-220 | 5-6 | 6-8 |
| 15 min | 280-320 | 7-8 | 8-10 |
| 20 min | 330-380 | 8-10 | 10-12 |
| 30 min | 420-480 | 10-12 | 12-15 |

Duration affects TTS character count (and cost) but NOT the number of LLM calls.

### CEFR Adjustment Factors

| Level | Factor | Effect |
|-------|--------|--------|
| A1 | 1.4x | Shorter sentences, slower pace = more words for same duration |
| A2 | 1.2x | |
| B1 | 1.0x | Baseline |
| B2 | 0.85x | |
| C1 | 0.7x | Dense content, fewer words needed |

### Admin Grant Presets

| Preset | Tokens | Approx. Full Tests (mini) | Approx. Full Tests (5.2+reasoning) |
|--------|--------|--------------------------|-------------------------------------|
| $1 | 300 | ~60 tests | ~15 tests |
| $2 | 600 | ~120 tests | ~30 tests |
| $5 | 1,500 | ~300 tests | ~75 tests |

*All costs are estimates based on March 2026 API pricing. Subject to change as provider prices and actual usage patterns evolve.*

---

## Key Decisions Still Needed

- [ ] Stripe integration for payment processing?
- [ ] Should ElevenLabs be premium-only or available on all tiers?
- [ ] Organization/multi-tenant schema or single admin for now?
- [ ] Monthly reset mechanism (cron job vs lazy reset on first request)?
- [x] Admin dashboard for usage analytics — IMPLEMENTED (v171)
- [x] Variable vs flat token pricing — DECIDED: Variable rate based on permutation
