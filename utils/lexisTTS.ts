import { LexisItem, LexisAudio } from '../types';
import { openaiSpeak, OPENAI_SPEECH_MODEL } from './openaiSpeech';

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

// Generate audio using OpenAI TTS (verbatim reading with a teacher-style instruction)
async function generateWithOpenAI(script: string): Promise<string | null> {
  try {
    console.log('[LexisTTS] Using OpenAI TTS with', OPENAI_SPEECH_MODEL);
    console.log('[LexisTTS] Script length:', script.length, 'characters');

    // Voice style only — openaiSpeak already enforces word-for-word reading
    const style = `Speak slowly and clearly like a patient teacher. Pause at each "..." in the text.`;

    const audioBlob = await openaiSpeak(script, 'onyx', style); // Deep male voice, good for teaching
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
