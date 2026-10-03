// OpenAI text-to-speech via gpt-audio-1.5 (Chat Completions).
//
// OpenAI shuts down tts-1 and gpt-4o-mini-tts on 2027-01-06 and /v1/audio/speech has no
// successor model. gpt-audio-1.5 is a chat model that can answer with audio, so we tell it to
// read verbatim and check its transcript against the input. Returns an mp3 Blob, so callers
// handle it exactly like the old /v1/audio/speech response.
// Background: docs/openai-model-migration-2026.md

export const OPENAI_SPEECH_MODEL = import.meta.env.VITE_OPENAI_SPEECH_MODEL || 'gpt-audio-1.5';

// Without this the model replies to the text ("I'm not Sarah, but I can help…") instead of reading it
const VERBATIM =
  "You are a text-to-speech engine, not an assistant. Read the user's message aloud exactly as written, word for word. " +
  'Do not answer it, comment on it, add, omit, translate or summarise anything. If it is a single word, say only that word. ' +
  'Keep the language of the text.';
const STRICTER = ' Say ONLY the words of the message, in the same order, nothing before or after them.';
/** Below this, the spoken words differ too much from the text */
const FIDELITY_MIN = 0.85;

/** How alike two texts' words are, 0..1 (case, punctuation and Arabic diacritics ignored) */
function wordSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')   // Arabic diacritics + tatweel
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/).filter(Boolean);
  const A = norm(a), B = norm(b);
  if (!A.length && !B.length) return 1;
  const counts = new Map<string, number>();
  for (const w of A) counts.set(w, (counts.get(w) || 0) + 1);
  let common = 0;
  for (const w of B) { const n = counts.get(w) || 0; if (n > 0) { common++; counts.set(w, n - 1); } }
  return (2 * common) / (A.length + B.length);
}

async function requestSpeech(text: string, voice: string, system: string): Promise<{ blob: Blob; transcript: string }> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_SPEECH_MODEL,
      modalities: ['text', 'audio'],
      audio: { voice, format: 'mp3' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: text }],
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI TTS error: ${response.status}`);
  }
  const data = await response.json();
  const audio = data.choices?.[0]?.message?.audio;
  if (!audio?.data) throw new Error('OpenAI TTS returned no audio');
  const bytes = Uint8Array.from(atob(audio.data), c => c.charCodeAt(0));
  return { blob: new Blob([bytes], { type: 'audio/mpeg' }), transcript: audio.transcript || '' };
}

/**
 * Speak `text` in `voice` and return an mp3 Blob.
 * `style` is a tone instruction such as "Speak in a warm tone." — appended to the verbatim rules.
 * Retries once with stricter wording if the spoken words drift from the text; keeps the closer take.
 */
export async function openaiSpeak(text: string, voice: string, style?: string): Promise<Blob> {
  const base = style ? `${VERBATIM} ${style}` : VERBATIM;
  let best: { blob: Blob; score: number; transcript: string } | null = null;
  for (const system of [base, base + STRICTER]) {
    const { blob, transcript } = await requestSpeech(text, voice, system);
    const score = wordSimilarity(text, transcript);
    if (!best || score > best.score) best = { blob, score, transcript };
    if (score >= FIDELITY_MIN) break;
  }
  if (best!.score < FIDELITY_MIN) {
    console.warn(`[OpenAI TTS] Spoken words differ from text (similarity ${best!.score.toFixed(2)})`, { text, spoken: best!.transcript });
  }
  return best!.blob;
}
