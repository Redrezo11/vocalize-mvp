// Token cost calculator — variable rates based on generation config
// See docs/CREDIT_BILLING_SYSTEM.md for full pricing research

export type ContentModel = 'gpt-5-mini' | 'gpt-5.2';
export type SpeakerCount = 1 | 2 | 3;

// Full JAM/OneShot generation — variable token matrix (all permutations)
// Verified against OpenAI pricing page + Gemini TTS docs, March 2026
const GENERATION_COSTS: Record<string, number> = {
  // mini, no reasoning
  'gpt-5-mini:false:1': 5,
  'gpt-5-mini:false:2': 7,
  'gpt-5-mini:false:3': 8,
  // mini, reasoning
  'gpt-5-mini:true:1': 8,
  'gpt-5-mini:true:2': 10,
  'gpt-5-mini:true:3': 11,
  // 5.2, no reasoning
  'gpt-5.2:false:1': 12,
  'gpt-5.2:false:2': 14,
  'gpt-5.2:false:3': 15,
  // 5.2, reasoning
  'gpt-5.2:true:1': 18,
  'gpt-5.2:true:2': 20,
  'gpt-5.2:true:3': 21,
};

/**
 * Get token cost for a full JAM/OneShot test generation.
 * Includes LLM calls + TTS + bonus generation.
 * Reading mode halves the cost (no TTS).
 */
export function getGenerationCost(config: {
  contentModel: ContentModel;
  useReasoning: boolean;
  speakerCount: SpeakerCount;
  isReading: boolean;
}): number {
  const key = `${config.contentModel}:${config.useReasoning}:${config.speakerCount}`;
  const listeningCost = GENERATION_COSTS[key] ?? 10; // fallback
  if (config.isReading) {
    return Math.max(1, Math.ceil(listeningCost / 2));
  }
  return listeningCost;
}

// Flat costs for other operations
export const OPERATION_COSTS = {
  // OneShot (no LLM, just TTS + bonus)
  oneshot_reading: 1,
  oneshot_listening: 3,
  // Classroom mode
  lexis_audio_batch: 2,
  classroom_narration: 1,  // per narration segment (pre-listening or plenary)
  json_repair: 1,          // LLM-based JSON repair fallback
  gender_resolution: 1,    // LLM-based gender classification for unknown names
} as const;
