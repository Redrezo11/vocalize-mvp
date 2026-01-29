import { LexisItem, LexisAudio, WordAudio } from '../types';
import { GoogleGenAI, Modality } from "@google/genai";

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

// Helper to create WAV header (same as useGeminiTTS.ts)
function createWavHeader(dataLength: number, numberOfChannels: number, sampleRate: number): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  return header;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Convert base64 PCM audio to WAV data URL
async function pcmToWavDataUrl(base64Audio: string): Promise<string> {
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // The audio is 16-bit PCM at 24kHz mono
  const numChannels = 1;
  const sampleRate = 24000;

  // Create WAV header
  const wavHeader = createWavHeader(bytes.length, numChannels, sampleRate);

  // Combine header and PCM data into a blob
  const wavBlob = new Blob([wavHeader, bytes], { type: 'audio/wav' });

  // Convert blob to base64 data URL
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(wavBlob);
  });
}

// Generate audio using Gemini TTS (same SDK as useGeminiTTS.ts)
async function generateWithGemini(script: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.log('[LexisTTS] No Gemini API key configured');
    return null;
  }

  try {
    console.log('[LexisTTS] Using GoogleGenAI SDK with gemini-2.5-flash-preview-tts model');
    const ai = new GoogleGenAI({ apiKey });

    // Use Orus (male, firm voice) for vocabulary teaching
    const speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: 'Orus' }
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text: script }],
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: speechConfig,
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      console.log('[LexisTTS] No audio data in Gemini response');
      return null;
    }

    // Convert PCM to WAV data URL
    const wavDataUrl = await pcmToWavDataUrl(base64Audio);
    return wavDataUrl;

  } catch (error: any) {
    const errorMsg = error?.message || String(error) || '';
    console.error('[LexisTTS] Gemini TTS error:', errorMsg);

    // Check if it's a quota error
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      console.log('[LexisTTS] Gemini quota exceeded');
    }

    return null;
  }
}

// Generate audio using ElevenLabs
async function generateWithElevenLabs(script: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.log('[LexisTTS] No ElevenLabs API key configured');
    return null;
  }

  try {
    // Use a male voice - "Adam" is a good clear male voice
    const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam voice ID

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_multilingual_v2', // Supports Arabic
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[LexisTTS] ElevenLabs error:', error);

      // Check for quota exceeded
      if (response.status === 401 || response.status === 429) {
        console.log('[LexisTTS] ElevenLabs quota exceeded or unauthorized');
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
    console.error('[LexisTTS] ElevenLabs failed:', error);
    return null;
  }
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
    console.log('[LexisTTS] Full script being sent:\n', script);

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

export type LexisTTSEngine = 'gemini' | 'openai';

// Main function to generate lexis audio
// If engine is specified, only use that engine (no fallback)
// If engine is not specified, use fallback chain: Gemini -> ElevenLabs -> OpenAI
export async function generateLexisAudio(lexis: LexisItem[], engine?: LexisTTSEngine): Promise<GenerateLexisAudioResult> {
  if (!lexis || lexis.length === 0) {
    return { success: false, error: 'No vocabulary items to generate audio for' };
  }

  const script = buildLexisScript(lexis);
  console.log('[LexisTTS] Generated script:', script);

  // If specific engine is requested, only use that one
  if (engine) {
    console.log(`[LexisTTS] Using specified engine: ${engine}`);
    let audioUrl: string | null = null;

    if (engine === 'gemini') {
      audioUrl = await generateWithGemini(script);
    } else if (engine === 'openai') {
      audioUrl = await generateWithOpenAI(script);
    }

    if (audioUrl) {
      return {
        success: true,
        audio: {
          url: audioUrl,
          generatedAt: new Date().toISOString(),
          engine: engine
        }
      };
    }

    return {
      success: false,
      error: `Failed to generate audio with ${engine === 'gemini' ? 'Gemini' : 'GPT-4o mini'}. Please try another engine or try again later.`
    };
  }

  // Fallback chain: Gemini -> ElevenLabs -> OpenAI
  console.log('[LexisTTS] Trying Gemini TTS...');
  let audioUrl = await generateWithGemini(script);

  if (audioUrl) {
    return {
      success: true,
      audio: {
        url: audioUrl,
        generatedAt: new Date().toISOString(),
        engine: 'gemini'
      }
    };
  }

  // Fallback to ElevenLabs
  console.log('[LexisTTS] Gemini failed, trying ElevenLabs...');
  audioUrl = await generateWithElevenLabs(script);

  if (audioUrl) {
    return {
      success: true,
      audio: {
        url: audioUrl,
        generatedAt: new Date().toISOString(),
        engine: 'elevenlabs'
      }
    };
  }

  // Fallback to OpenAI
  console.log('[LexisTTS] ElevenLabs failed, trying OpenAI...');
  audioUrl = await generateWithOpenAI(script);

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

  // All failed
  return {
    success: false,
    error: 'TTS quota exceeded for Gemini, ElevenLabs, and OpenAI. Please try again later.'
  };
}

// Build script for a single word (for per-word audio generation)
export function buildSingleWordScript(item: LexisItem, index: number): string {
  const english = item.term;
  const arabic = item.definitionArabic || '';
  // Simple format: "Word number X. [English]. In Arabic: [Arabic]."
  return `Word number ${index + 1}. ${english}. In Arabic: ${arabic}.`;
}

// Generate audio for a single vocabulary word
export async function generateSingleWordAudio(
  item: LexisItem,
  index: number,
  engine: LexisTTSEngine
): Promise<{ url: string; duration?: number } | null> {
  const script = buildSingleWordScript(item, index);
  console.log(`[LexisTTS] Generating audio for word ${index + 1}: ${item.term}`);

  let audioUrl: string | null = null;

  if (engine === 'gemini') {
    audioUrl = await generateWithGemini(script);
  } else if (engine === 'openai') {
    audioUrl = await generateWithOpenAI(script);
  }

  if (!audioUrl) {
    console.error(`[LexisTTS] Failed to generate audio for word: ${item.term}`);
    return null;
  }

  // Try to estimate duration from the audio data
  // For now, we'll let the browser calculate it when loaded
  return { url: audioUrl };
}

// Generate per-word audio for all vocabulary items
export interface GenerateWordAudiosResult {
  success: boolean;
  wordAudios?: { [wordId: string]: WordAudio };
  error?: string;
  failedWords?: string[];
}

export async function generateAllWordAudios(
  lexis: LexisItem[],
  engine: LexisTTSEngine,
  onProgress?: (current: number, total: number, wordTerm: string) => void
): Promise<GenerateWordAudiosResult> {
  if (!lexis || lexis.length === 0) {
    return { success: false, error: 'No vocabulary items to generate audio for' };
  }

  const wordAudios: { [wordId: string]: WordAudio } = {};
  const failedWords: string[] = [];

  for (let i = 0; i < lexis.length; i++) {
    const item = lexis[i];

    // Report progress
    if (onProgress) {
      onProgress(i + 1, lexis.length, item.term);
    }

    const result = await generateSingleWordAudio(item, i, engine);

    if (result) {
      wordAudios[item.id] = result;
    } else {
      failedWords.push(item.term);
    }

    // Small delay between requests to avoid rate limiting
    if (i < lexis.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  if (Object.keys(wordAudios).length === 0) {
    return {
      success: false,
      error: 'Failed to generate audio for any words',
      failedWords
    };
  }

  return {
    success: true,
    wordAudios,
    failedWords: failedWords.length > 0 ? failedWords : undefined
  };
}
