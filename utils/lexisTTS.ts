import { LexisItem, LexisAudio } from '../types';

// Build the script for TTS
export function buildLexisScript(lexis: LexisItem[]): string {
  const intro = "The key vocabulary words are:\n\n";

  const words = lexis.map((item, index) => {
    const number = index + 1;
    const english = item.term;
    // Use Arabic definition as the Arabic word/phrase
    const arabic = item.definitionArabic || '';

    // Clear explicit format - avoid "..." which AI might interpret as omission
    return `Word number ${number}. ${english}. In Arabic: ${arabic}.`;
  }).join('\n\n');

  // Add clear ending
  const ending = "\n\nThat is all the vocabulary for today.";

  return intro + words + ending;
}

// Generate audio using OpenAI TTS (gpt-4o-mini-tts with instructions)
async function generateWithOpenAI(script: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.log('[LexisTTS] No OpenAI API key configured');
    return null;
  }

  try {
    console.log('[LexisTTS] Using OpenAI TTS with gpt-4o-mini-tts model');
    console.log('[LexisTTS] Script length:', script.length, 'characters');

    // Simple instructions - just voice style, not content interpretation
    // Note: Detailed instructions can cause gpt-4o-mini-tts to skip/modify content
    const instructions = `Speak slowly and clearly like a patient teacher. Read every single word exactly as written. Do not skip any items. Pause at each "..." in the text.`;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: script,
        voice: 'onyx', // Deep male voice, good for teaching
        instructions: instructions,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[LexisTTS] OpenAI TTS error:', error);

      if (response.status === 429) {
        console.log('[LexisTTS] OpenAI quota exceeded');
      }
      return null;
    }

    // Get audio as blob and convert to base64
    const audioBlob = await response.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return `data:audio/mpeg;base64,${base64}`;
  } catch (error) {
    console.error('[LexisTTS] OpenAI TTS failed:', error);
    return null;
  }
}

export interface GenerateLexisAudioResult {
  success: boolean;
  audio?: LexisAudio;
  error?: string;
}

// Generate full-batch lexis audio using OpenAI TTS
export async function generateLexisAudio(lexis: LexisItem[]): Promise<GenerateLexisAudioResult> {
  if (!lexis || lexis.length === 0) {
    return { success: false, error: 'No vocabulary items to generate audio for' };
  }

  const script = buildLexisScript(lexis);
  console.log('[LexisTTS] Generated script for', lexis.length, 'words');

  const audioUrl = await generateWithOpenAI(script);

  if (audioUrl) {
    return {
      success: true,
      audio: {
        url: audioUrl,
        generatedAt: new Date().toISOString(),
        engine: 'openai'
      }
    };
  }

  return {
    success: false,
    error: 'Failed to generate audio with OpenAI. Please try again later.'
  };
}
