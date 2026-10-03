// Single source of truth for OpenAI model ids.
//
// The app stores and bills by *internal* keys ('gpt-5-mini', 'gpt-5.2') — they live in user
// settings, token cost tables and UsageLog rows — so those keys never change. This file maps
// them to whatever OpenAI model currently serves that tier. When OpenAI retires a model, change
// it here (or override with an env var) and nothing else has to move.
// Background: docs/openai-model-migration-2026.md
import type { ContentModel } from './tokenCosts';

const env = import.meta.env;

// gpt-5-mini / gpt-5-nano shut down 2026-12-11; gpt-5.6-luna is the price-matched successor.
const FAST_MODEL = env.VITE_OPENAI_FAST_MODEL || 'gpt-5.6-luna';
const PREMIUM_MODEL = env.VITE_OPENAI_PREMIUM_MODEL || 'gpt-5.2';

/** Model for small helper calls (titles, lexis, JSON repair) — replaces every former 'gpt-5-nano' */
export const OPENAI_UTILITY_MODEL = FAST_MODEL;

/** Internal content-model key → OpenAI model id. Non-OpenAI keys (claude-sonnet) and real ids pass through. */
export function toApiModel(model: ContentModel | string): string {
  if (model === 'gpt-5-mini') return FAST_MODEL;
  if (model === 'gpt-5.2') return PREMIUM_MODEL;
  return model;
}

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

/**
 * The `reasoning` field for a Responses API body, or nothing for non-reasoning models (gpt-4o-mini).
 * On gpt-5.6 models, omitting `reasoning` means *medium* effort, not none — so calls that mean
 * "no reasoning" must say 'none' explicitly.
 */
export function reasoningFor(apiModel: string, effort: ReasoningEffort): { reasoning?: { effort: ReasoningEffort | 'minimal' } } {
  if (!/^(gpt-5|o\d)/.test(apiModel)) return {};
  // The original gpt-5 family has no 'none' (400 error); 'minimal' is its lowest setting
  if (effort === 'none' && /^gpt-5(-mini|-nano)?(-\d{4}-\d{2}-\d{2})?$/.test(apiModel)) return { reasoning: { effort: 'minimal' } };
  return { reasoning: { effort } };
}
