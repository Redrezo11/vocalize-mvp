import React, { useState, useEffect, useRef } from 'react';
import { CEFRLevel, ContentMode } from './Settings';
import { EngineType, SavedAudio, ListeningTest, SpeakerVoiceMapping } from '../types';
import { parseDialogue, assignOpenAIVoices } from '../utils/parser';
import { concatenateAudioBlobs } from '../hooks/useElevenLabsTTS';
import { buildDialoguePrompt, buildPassagePrompt, buildTestContentPrompt, validatePayload, OneShotPayload } from './OneShotCreator';
import { EFL_TOPICS, SpeakerCount, AudioFormat, getRandomTopic, getRandomFormat, getCompatibleTopic, shuffleFormat, randomSpeakerCount } from '../utils/eflTopics';
import { getRandomReadingTopic, getRandomReadingGenre, getCompatibleReadingTopic, shuffleReadingGenre } from '../utils/readingTopics';
import { useAppMode } from '../contexts/AppModeContext';

const API_BASE = '/api';

// --- Content Model Configuration ---
export type ContentModel = 'gpt-5-mini' | 'gpt-5.2';

const MODEL_CONFIG: Record<ContentModel, {
  name: string;
  cost: string;
  description: string;
}> = {
  'gpt-5-mini': {
    name: 'GPT-5 Mini',
    cost: '<$0.001',
    description: 'Fast and economical'
  },
  'gpt-5.2': {
    name: 'GPT-5.2',
    cost: '<$0.01',
    description: 'Higher quality output'
  },
};

// --- Jam Profile Types ---
export interface JamProfile {
  difficulty: CEFRLevel;
  contentMode: ContentMode;
  contentModel: ContentModel;
  targetDuration: number; // 5-30 minutes
  includePreview: boolean;
  includeExplanations: boolean;
  explanationLanguage: 'english' | 'arabic' | 'both';
  useReasoning: boolean; // true = low/medium reasoning, false = none (faster)
  speakerCount?: SpeakerCount;
}

const DEFAULT_JAM_PROFILE: JamProfile = {
  difficulty: 'B1',
  contentMode: 'standard',
  contentModel: 'gpt-5-mini',
  targetDuration: 10, // 10 minutes default
  includePreview: true,
  includeExplanations: true,
  explanationLanguage: 'both',
  useReasoning: true,
};

// --- Processing stages ---
type JamStage = 'idle' | 'generating' | 'audio' | 'audio_failed' | 'saving' | 'done' | 'error';

const STAGE_CONFIG: Record<JamStage, { label: string; labelAr: string; progress: number }> = {
  idle: { label: 'Ready', labelAr: 'جاهز', progress: 0 },
  generating: { label: 'Generating content...', labelAr: 'جاري إنشاء المحتوى...', progress: 20 },
  audio: { label: 'Creating audio...', labelAr: 'جاري إنشاء الصوت...', progress: 50 },
  audio_failed: { label: 'Audio generation failed', labelAr: 'فشل إنشاء الصوت', progress: 50 },
  saving: { label: 'Saving test...', labelAr: 'جاري حفظ الاختبار...', progress: 80 },
  done: { label: 'Complete!', labelAr: 'تم!', progress: 100 },
  error: { label: 'Error', labelAr: 'خطأ', progress: 0 },
};

// --- Icons ---
const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// --- Helper functions ---
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- Props ---
interface JamButtonProps {
  defaultProfile?: Partial<JamProfile>;
  defaultDifficulty?: CEFRLevel;
  contentMode?: ContentMode;
  topic?: string;
  autoStart?: boolean;
  onComplete: (result: { audioEntry: SavedAudio | null; test: ListeningTest }) => void;
  onError?: (error: string) => void;
}

// --- Settings Modal Component ---
const JamSettingsModal: React.FC<{
  profile: JamProfile;
  onSave: (profile: JamProfile) => void;
  onClose: () => void;
}> = ({ profile, onSave, onClose }) => {
  const [localProfile, setLocalProfile] = useState(profile);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-slate-800">Jam Profile Settings</h2>

        {/* Content Mode */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Content Mode</label>
          <select
            value={localProfile.contentMode}
            onChange={(e) => setLocalProfile(p => ({ ...p, contentMode: e.target.value as ContentMode }))}
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="standard">Standard</option>
            <option value="halal">Halal</option>
            <option value="elsd">ELSD (University)</option>
          </select>
        </div>

        {/* AI Model */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">AI Model</label>
          <div className="space-y-2">
            {(Object.keys(MODEL_CONFIG) as ContentModel[]).map((model) => {
              const config = MODEL_CONFIG[model];
              return (
                <button
                  key={model}
                  onClick={() => setLocalProfile(p => ({ ...p, contentModel: model }))}
                  className={`w-full p-3 rounded-lg text-left border-2 transition-all ${
                    localProfile.contentModel === model
                      ? 'border-red-500 bg-red-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-800">{config.name}</span>
                    <span className="text-sm font-bold text-red-600">{config.cost}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{config.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Reasoning */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localProfile.useReasoning}
              onChange={(e) => setLocalProfile(p => ({ ...p, useReasoning: e.target.checked }))}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-sm text-slate-700">Enable AI reasoning</span>
          </label>
          <p className="text-xs text-slate-500 mt-1 ml-6">
            {localProfile.useReasoning ? 'Higher quality, slower generation' : 'Faster generation, may reduce quality'}
          </p>
        </div>

        {/* Test Duration */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Test Duration: <span className="font-bold text-red-600">{localProfile.targetDuration} min</span>
          </label>
          <input
            type="range"
            min="5"
            max="30"
            step="5"
            value={localProfile.targetDuration}
            onChange={(e) => setLocalProfile(p => ({ ...p, targetDuration: parseInt(e.target.value) }))}
            className="w-full accent-red-500"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>5 min</span>
            <span>15 min</span>
            <span>30 min</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            AI determines question and vocabulary counts based on duration and CEFR level
          </p>
        </div>

        {/* Preview Activities */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localProfile.includePreview}
              onChange={(e) => setLocalProfile(p => ({ ...p, includePreview: e.target.checked }))}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-sm text-slate-700">Include preview activities</span>
          </label>
        </div>

        {/* Explanations */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localProfile.includeExplanations}
              onChange={(e) => setLocalProfile(p => ({ ...p, includeExplanations: e.target.checked }))}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-sm text-slate-700">Include explanations</span>
          </label>
        </div>

        {/* Explanation Language */}
        {localProfile.includeExplanations && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Explanation Language</label>
            <select
              value={localProfile.explanationLanguage}
              onChange={(e) => setLocalProfile(p => ({ ...p, explanationLanguage: e.target.value as 'english' | 'arabic' | 'both' }))}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="english">English</option>
              <option value="arabic">Arabic</option>
              <option value="both">Both</option>
            </select>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(localProfile)}
            className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main JamButton Component ---
export const JamButton: React.FC<JamButtonProps> = ({
  defaultProfile,
  defaultDifficulty,
  contentMode,
  topic,
  autoStart = false,
  onComplete,
  onError,
}) => {
  const appMode = useAppMode();
  const isReading = appMode === 'reading';

  // Profile state - merge defaults with any passed profile/settings
  const [profile, setProfile] = useState<JamProfile>({
    ...DEFAULT_JAM_PROFILE,
    ...(defaultDifficulty && { difficulty: defaultDifficulty }),
    ...(contentMode && { contentMode }),
    ...defaultProfile,
  });
  const [showSettings, setShowSettings] = useState(false);

  // Use ref instead of state to prevent StrictMode double-invocation
  const hasAutoStartedRef = useRef(false);

  // Processing state
  const [stage, setStage] = useState<JamStage>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [generatingLabel, setGeneratingLabel] = useState('');

  // Speaker count & format state (listening mode)
  const [speakerCount, setSpeakerCount] = useState<SpeakerCount>(profile.speakerCount || 2);
  const [audioFormat, setAudioFormat] = useState<AudioFormat | null>(() => getRandomFormat(profile.speakerCount || 2));

  // Reading genre state
  const [readingGenre, setReadingGenre] = useState(() => getRandomReadingGenre());

  // Topic state
  const [currentTopic, setCurrentTopic] = useState(() =>
    isReading
      ? getRandomReadingTopic()
      : (audioFormat ? getCompatibleTopic(audioFormat) : getRandomTopic(profile.speakerCount || 2))
  );
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');

  const shuffleTopic = () => {
    if (isReading) {
      setCurrentTopic(getCompatibleReadingTopic(readingGenre, currentTopic));
    } else {
      setCurrentTopic(audioFormat ? getCompatibleTopic(audioFormat, currentTopic) : getRandomTopic(speakerCount, currentTopic));
    }
    setIsCustomTopic(false);
  };

  const shuffleGenre = () => {
    const newGenre = shuffleReadingGenre(readingGenre.id);
    setReadingGenre(newGenre);
    setCurrentTopic(getCompatibleReadingTopic(newGenre, currentTopic));
    setIsCustomTopic(false);
  };

  const handleSpeakerCountChange = (count: SpeakerCount) => {
    setSpeakerCount(count);
    const newFormat = getRandomFormat(count);
    setAudioFormat(newFormat);
    setCurrentTopic(getCompatibleTopic(newFormat));
    setIsCustomTopic(false);
  };

  // Pending data for audio fallback (when Gemini fails)
  const [pendingPayload, setPendingPayload] = useState<OneShotPayload | null>(null);
  const [pendingSpeakerMapping, setPendingSpeakerMapping] = useState<SpeakerVoiceMapping>({});
  const [pendingAnalysis, setPendingAnalysis] = useState<{ speakers: string[] } | null>(null);
  const [audioFailReason, setAudioFailReason] = useState<string>('');

  // --- Audio generation helpers ---

  // Generate audio with Gemini TTS (returns base64 WAV)
  const generateGeminiAudio = async (transcript: string, speakerMapping: SpeakerVoiceMapping): Promise<string> => {
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'PLACEHOLDER_API_KEY') {
      throw new Error('Gemini API key not configured');
    }

    const { GoogleGenAI, Modality } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const speakers = Object.entries(speakerMapping);
    const speechConfig = speakers.length >= 2
      ? {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: speakers.map(([speaker, voice]) => ({
              speaker,
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            })),
          },
        }
      : {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: speakers[0]?.[1] || 'Charon' },
          },
        };

    const audioResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: transcript,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig,
      },
    });

    const audioData = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error('No audio data returned from Gemini');
    }

    // Convert PCM to WAV
    const pcmBytes = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBytes.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const wavBytes = new Uint8Array(buffer);
    wavBytes.set(pcmBytes, 44);

    const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });
    return blobToBase64(wavBlob);
  };

  // Generate audio with OpenAI TTS (returns base64, multi-voice for dialogues)
  const generateOpenAIAudio = async (transcript: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      throw new Error('OpenAI API key not configured');
    }

    const analysis = parseDialogue(transcript);

    // Multi-speaker: generate each segment with a different voice
    if (analysis.isDialogue && analysis.segments.length > 1) {
      const openaiMapping = assignOpenAIVoices(analysis.speakers);

      const blobs: Blob[] = [];
      for (const segment of analysis.segments) {
        const voice = openaiMapping[segment.speaker] || 'alloy';
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: segment.text,
            voice,
            response_format: 'mp3',
          }),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error?.message || `OpenAI TTS error: ${response.status}`);
        }
        blobs.push(await response.blob());
      }

      const combined = await concatenateAudioBlobs(blobs);
      return blobToBase64(combined);
    }

    // Single speaker — one voice
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: transcript,
        voice: 'alloy',
        response_format: 'mp3',
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI TTS error: ${response.status}`);
    }
    return blobToBase64(await response.blob());
  };

  // Save entry and test (shared by all audio paths)
  const saveEntryAndTest = async (
    payload: OneShotPayload,
    audioBase64: string | null,
    engine: EngineType,
    speakerMapping: SpeakerVoiceMapping,
    speakers: string[]
  ) => {
    setStage('saving');
    setProgress(STAGE_CONFIG.saving.progress);

    const audioEntryResponse = await fetch(`${API_BASE}/audio-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title,
        transcript: payload.transcript,
        audio_data: audioBase64,
        engine,
        speaker_mapping: speakerMapping,
        speakers,
        is_transcript_only: !audioBase64,
        difficulty: payload.difficulty,
      }),
    });

    if (!audioEntryResponse.ok) {
      throw new Error('Failed to save audio entry');
    }

    const audioEntry = await audioEntryResponse.json();
    const savedAudio: SavedAudio = {
      id: audioEntry._id,
      title: audioEntry.title,
      transcript: audioEntry.transcript,
      audioUrl: audioEntry.audio_url,
      engine: audioEntry.engine,
      speakerMapping: audioEntry.speaker_mapping || {},
      speakers: audioEntry.speakers || [],
      isTranscriptOnly: audioEntry.is_transcript_only,
      difficulty: audioEntry.difficulty,
      createdAt: audioEntry.created_at,
      updatedAt: audioEntry.updated_at,
    };

    // Save test
    const testResponse = await fetch(`${API_BASE}/tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioId: savedAudio.id,
        title: payload.title,
        type: 'listening-comprehension',
        speakerCount: speakers.length,
        questions: payload.questions.map(q => ({
          ...q,
          id: generateId(),
        })),
        lexis: payload.lexis?.map(l => ({
          ...l,
          id: generateId(),
        })) || [],
        preview: payload.preview?.map(p => ({
          ...p,
          items: p.items.map((item: any) => ({ ...item, id: generateId() })),
        })) || [],
        classroomActivity: payload.classroomActivity || undefined,
        transferQuestion: payload.transferQuestion || undefined,
        difficulty: payload.difficulty,
      }),
    });

    if (!testResponse.ok) {
      throw new Error('Failed to save test');
    }

    const testData = await testResponse.json();
    const savedTest: ListeningTest = {
      id: testData._id,
      audioId: testData.audioId,
      title: testData.title,
      type: testData.type,
      questions: testData.questions?.map((q: any) => ({ ...q, id: q._id || generateId() })) || [],
      lexis: testData.lexis?.map((l: any) => ({ ...l, id: l._id || generateId() })),
      preview: testData.preview,
      classroomActivity: testData.classroomActivity,
      transferQuestion: testData.transferQuestion,
      difficulty: testData.difficulty,
      createdAt: testData.created_at,
      updatedAt: testData.updated_at,
    };

    setStage('done');
    setProgress(100);

    setTimeout(() => {
      onComplete({ audioEntry: savedAudio, test: savedTest });
    }, 500);
  };

  // Handle OpenAI TTS fallback
  const handleOpenAIFallback = async () => {
    if (!pendingPayload || !pendingAnalysis) return;

    setStage('audio');
    setProgress(STAGE_CONFIG.audio.progress);
    setErrorMsg('');

    try {
      const audioBase64 = await generateOpenAIAudio(pendingPayload.transcript);
      await saveEntryAndTest(
        pendingPayload,
        audioBase64,
        EngineType.BROWSER, // We'll use BROWSER as a stand-in for OpenAI TTS
        pendingSpeakerMapping,
        pendingAnalysis.speakers
      );
    } catch (err) {
      console.error('[JamButton] OpenAI TTS also failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'OpenAI TTS failed';
      setAudioFailReason(`Both Gemini and OpenAI failed. Last error: ${errorMessage}`);
      setStage('audio_failed');
    }
  };

  // Handle transcript-only fallback (last resort)
  const handleTranscriptOnlyFallback = async () => {
    if (!pendingPayload || !pendingAnalysis) return;

    try {
      await saveEntryAndTest(
        pendingPayload,
        null, // No audio
        EngineType.BROWSER,
        pendingSpeakerMapping,
        pendingAnalysis.speakers
      );
    } catch (err) {
      console.error('[JamButton] Save failed:', err);
      setStage('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleJam = async () => {
    setStage('generating');
    setProgress(10);
    setErrorMsg('');
    setGeneratingLabel(isReading ? 'Generating passage...' : 'Generating dialogue...');

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        throw new Error('OpenAI API key not configured');
      }

      // --- Call 1: Generate content (dialogue for listening, passage for reading) ---
      const effectiveTopic = topic || (isCustomTopic ? customTopic : currentTopic);
      const dialoguePrompt = isReading
        ? buildPassagePrompt(profile.difficulty, profile.contentMode, profile.targetDuration, effectiveTopic, readingGenre)
        : buildDialoguePrompt(profile.difficulty, profile.contentMode, profile.targetDuration, effectiveTopic, speakerCount, audioFormat || undefined);

      const dialogueResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: profile.contentModel,
          instructions: dialoguePrompt.instructions,
          input: dialoguePrompt.input,
          ...(profile.useReasoning && { reasoning: { effort: 'low' } }),
        }),
      });

      if (!dialogueResponse.ok) {
        const error = await dialogueResponse.json().catch(() => ({}));
        throw new Error(error.error?.message || `Dialogue API error: ${dialogueResponse.status}`);
      }

      const dialogueData = await dialogueResponse.json();
      const dialogueOutput = dialogueData.output?.find((o: { type: string }) => o.type === 'message');
      const dialogueText = dialogueOutput?.content?.[0]?.text || '';

      const dialogueJsonMatch = dialogueText.match(/\{[\s\S]*\}/);
      if (!dialogueJsonMatch) {
        throw new Error('No valid JSON found in dialogue response');
      }

      let dialogueResult: { title: string; difficulty: string; transcript: string; passage?: string; voiceAssignments: Record<string, string> };
      try {
        dialogueResult = JSON.parse(dialogueJsonMatch[0]);
      } catch {
        throw new Error('Failed to parse dialogue JSON');
      }

      // Reading mode: accept "passage" as alias for "transcript"
      if (dialogueResult.passage && !dialogueResult.transcript) {
        dialogueResult.transcript = dialogueResult.passage;
      }

      if (isReading) {
        if (!dialogueResult.title || !dialogueResult.transcript) {
          throw new Error('Passage response missing required fields (title, passage)');
        }
        dialogueResult.voiceAssignments = dialogueResult.voiceAssignments || {};
      } else {
        if (!dialogueResult.title || !dialogueResult.transcript || !dialogueResult.voiceAssignments) {
          throw new Error('Dialogue response missing required fields (title, transcript, voiceAssignments)');
        }
      }

      // --- Call 2: Generate test content (analytical, medium reasoning) ---
      setProgress(35);
      setGeneratingLabel('Creating test questions...');

      const testPrompt = buildTestContentPrompt(
        { title: dialogueResult.title, transcript: dialogueResult.transcript, difficulty: profile.difficulty },
        profile.contentMode,
        profile.targetDuration
      );

      const testResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: profile.contentModel,
          instructions: testPrompt.instructions,
          input: testPrompt.input,
          ...(profile.useReasoning && { reasoning: { effort: 'medium' } }),
        }),
      });

      if (!testResponse.ok) {
        const error = await testResponse.json().catch(() => ({}));
        throw new Error(error.error?.message || `Test content API error: ${testResponse.status}`);
      }

      const testData = await testResponse.json();
      const testOutput = testData.output?.find((o: { type: string }) => o.type === 'message');
      const testText = testOutput?.content?.[0]?.text || '';

      const testJsonMatch = testText.match(/\{[\s\S]*\}/);
      if (!testJsonMatch) {
        throw new Error('No valid JSON found in test content response');
      }

      let testResult: { questions: any[]; lexis: any[]; preview: any[]; classroomActivity?: any; transferQuestion?: any };
      try {
        testResult = JSON.parse(testJsonMatch[0]);
      } catch {
        throw new Error('Failed to parse test content JSON');
      }

      if (!testResult.questions || !Array.isArray(testResult.questions)) {
        throw new Error('Test content response missing questions array');
      }

      // --- Merge into single payload and validate ---
      const mergedPayload: OneShotPayload = validatePayload(JSON.stringify({
        title: dialogueResult.title,
        difficulty: dialogueResult.difficulty || profile.difficulty,
        transcript: dialogueResult.transcript,
        voiceAssignments: dialogueResult.voiceAssignments,
        questions: testResult.questions,
        lexis: testResult.lexis || [],
        preview: testResult.preview || [],
        classroomActivity: testResult.classroomActivity || undefined,
        transferQuestion: testResult.transferQuestion || undefined,
      }));

      setGeneratingLabel('');

      // --- Reading mode: skip audio, save test directly ---
      if (isReading) {
        setStage('saving');
        setProgress(80);

        const testData = {
          title: mergedPayload.title,
          type: 'reading-comprehension',
          difficulty: mergedPayload.difficulty,
          sourceText: mergedPayload.transcript, // passage text stored as source_text
          questions: mergedPayload.questions.map(q => ({
            ...q,
            id: generateId(),
          })),
          lexis: mergedPayload.lexis?.map(l => ({
            ...l,
            id: generateId(),
          })) || [],
          preview: mergedPayload.preview?.map(p => ({
            ...p,
            items: p.items.map((item: any) => ({ ...item, id: generateId() })),
          })) || [],
          classroomActivity: mergedPayload.classroomActivity || undefined,
          transferQuestion: mergedPayload.transferQuestion || undefined,
        };

        const testResponse = await fetch(`${API_BASE}/tests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
        });

        if (!testResponse.ok) throw new Error('Failed to save test');
        const testDataResult = await testResponse.json();

        const savedTest: ListeningTest = {
          id: testDataResult._id,
          audioId: '',
          title: testDataResult.title,
          type: testDataResult.type,
          questions: testDataResult.questions?.map((q: any) => ({ ...q, id: q._id || generateId() })) || [],
          lexis: testDataResult.lexis?.map((l: any) => ({ ...l, id: l._id || generateId() })),
          preview: testDataResult.preview,
          classroomActivity: testDataResult.classroomActivity,
          transferQuestion: testDataResult.transferQuestion,
          sourceText: testDataResult.source_text,
          difficulty: testDataResult.difficulty,
          createdAt: testDataResult.created_at,
          updatedAt: testDataResult.updated_at,
        };

        setStage('done');
        setProgress(100);

        setTimeout(() => {
          onComplete({ audioEntry: null, test: savedTest });
        }, 500);
        return;
      }

      // --- Stage 2: Generate audio with Gemini TTS ---
      setStage('audio');
      setProgress(50);

      // Parse dialogue to get speakers
      const analysis = parseDialogue(mergedPayload.transcript);
      const speakerMapping: SpeakerVoiceMapping = {};
      for (const [speaker, voice] of Object.entries(mergedPayload.voiceAssignments || {})) {
        speakerMapping[speaker] = voice;
      }

      // Store pending data in case audio fails
      setPendingPayload(mergedPayload);
      setPendingSpeakerMapping(speakerMapping);
      setPendingAnalysis(analysis);

      // Try Gemini TTS first
      let wavBase64: string;
      try {
        wavBase64 = await generateGeminiAudio(mergedPayload.transcript, speakerMapping);
      } catch (geminiError) {
        console.error('[JamButton] Gemini TTS failed:', geminiError);
        const errorMessage = geminiError instanceof Error ? geminiError.message : 'Gemini TTS failed';

        const isQuotaError = errorMessage.toLowerCase().includes('quota') ||
                            errorMessage.toLowerCase().includes('rate') ||
                            errorMessage.toLowerCase().includes('limit') ||
                            errorMessage.includes('429') ||
                            errorMessage.includes('503');

        setAudioFailReason(isQuotaError ? 'Gemini quota exceeded' : errorMessage);
        setStage('audio_failed');
        return;
      }

      // --- Stage 3: Save entry and test ---
      await saveEntryAndTest(
        mergedPayload,
        wavBase64,
        EngineType.GEMINI,
        speakerMapping,
        analysis.speakers
      );

    } catch (err) {
      console.error('[JamButton] Error:', err);
      setStage('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setErrorMsg(errorMessage);
      onError?.(errorMessage);
    }
  };

  // Auto-start generation if requested (use ref to survive StrictMode double-mount)
  useEffect(() => {
    if (autoStart && !hasAutoStartedRef.current && stage === 'idle') {
      hasAutoStartedRef.current = true;
      handleJam();
    }
  }, [autoStart, stage]);

  const stageConfig = STAGE_CONFIG[stage];

  // Simplified view for autoStart mode (just shows progress)
  if (autoStart) {
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        {/* Title with difficulty badge */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Generating {profile.difficulty} Test</h2>
          <p className="text-sm text-slate-500">Creating your listening test...</p>
        </div>

        {/* Animated progress circle */}
        <div className="relative w-32 h-32">
          {/* Background circle */}
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#e2e8f0"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="url(#redGradient)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={352}
              strokeDashoffset={352 - (352 * progress) / 100}
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex items-center justify-center">
            {stage === 'done' ? (
              <span className="text-4xl text-green-500">✓</span>
            ) : stage === 'error' ? (
              <span className="text-3xl text-red-500">!</span>
            ) : (
              <span className="text-2xl font-bold text-slate-700">{progress}%</span>
            )}
          </div>
        </div>

        {/* Status label */}
        <div className="text-center">
          <div className="text-sm font-medium text-slate-600">
            {stage === 'generating' && generatingLabel ? generatingLabel : stageConfig.label}
          </div>
        </div>

        {/* Error message */}
        {stage === 'error' && (
          <div className="text-center">
            <div className="text-red-500 text-sm mb-2">{errorMsg}</div>
            <button
              onClick={() => {
                setStage('idle');
                hasAutoStartedRef.current = false;
              }}
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Audio generation failed - show fallback options */}
        {stage === 'audio_failed' && (
          <div className="text-center space-y-4 w-full max-w-sm">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-amber-800 text-sm font-medium mb-1">Audio Generation Failed</p>
              <p className="text-amber-600 text-xs">{audioFailReason}</p>
            </div>

            <p className="text-sm text-slate-600">Choose how to proceed:</p>

            <div className="space-y-2">
              {/* OpenAI TTS fallback - only show if not already tried */}
              {!audioFailReason.includes('OpenAI') && (
                <button
                  onClick={handleOpenAIFallback}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium
                             hover:from-blue-400 hover:to-blue-500 transition-all"
                >
                  Try OpenAI TTS Instead
                  <span className="block text-xs text-blue-100 mt-0.5">Single voice narration</span>
                </button>
              )}

              {/* Transcript-only option */}
              <button
                onClick={handleTranscriptOnlyFallback}
                className="w-full py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-medium
                           hover:bg-slate-200 transition-all border border-slate-200"
              >
                Save Without Audio
                <span className="block text-xs text-slate-500 mt-0.5">Transcript and test only</span>
              </button>

              {/* Cancel/retry */}
              <button
                onClick={() => {
                  setStage('idle');
                  hasAutoStartedRef.current = false;
                  setPendingPayload(null);
                }}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Cost indicator */}
        {stage !== 'audio_failed' && (
          <span className="text-xs text-slate-400">{MODEL_CONFIG[profile.contentModel].cost} per test</span>
        )}
      </div>
    );
  }

  // Full interactive view (when not autoStart)
  return (
    <div className="relative">
      {/* Settings button */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute -top-2 -right-2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
        title="Jam Settings"
      >
        <SettingsIcon className="w-5 h-5" />
      </button>

      <div className="flex flex-col items-center gap-6 pt-4">
          {/* Title */}
          <h2 className="text-xl font-bold text-slate-800">Quick Generate</h2>

          {/* Difficulty selector */}
          <div className="flex gap-2">
            {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setProfile(p => ({ ...p, difficulty: level }))}
                disabled={stage !== 'idle'}
                className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
                  profile.difficulty === level
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                } disabled:opacity-50`}
              >
                {level}
              </button>
            ))}
          </div>

          {isReading ? (
            /* Genre control — reading mode */
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 mr-1">Genre:</span>
              <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 text-sm text-emerald-700 font-medium truncate">
                {readingGenre.label}
              </div>
              <button
                onClick={shuffleGenre}
                disabled={stage !== 'idle'}
                className="px-2.5 py-1.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all disabled:opacity-50"
                title="Shuffle genre"
              >
                🎲
              </button>
            </div>
          ) : (
            /* Speaker Count — listening mode */
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 mr-1">Speakers:</span>
              {([1, 2, 3] as SpeakerCount[]).map((count) => (
                <button
                  key={count}
                  onClick={() => handleSpeakerCountChange(count)}
                  disabled={stage !== 'idle'}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    speakerCount === count
                      ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  } disabled:opacity-50`}
                >
                  {count === 3 ? '3+' : count}
                </button>
              ))}
              <button
                onClick={() => {
                  const count = randomSpeakerCount(speakerCount);
                  setSpeakerCount(count);
                  const newFormat = getRandomFormat(count);
                  setAudioFormat(newFormat);
                  setCurrentTopic(getCompatibleTopic(newFormat));
                  setIsCustomTopic(false);
                }}
                disabled={stage !== 'idle'}
                className="px-2.5 py-1.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-all disabled:opacity-50"
                title="Random speaker count"
              >
                🎲
              </button>
            </div>
          )}

          {/* Topic */}
          <div className="flex items-center gap-2 w-full max-w-sm">
            {isCustomTopic ? (
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Type a custom topic..."
                className="flex-1 px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                autoFocus
              />
            ) : (
              <div className="flex-1 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700 truncate">
                {currentTopic}
              </div>
            )}
            <button
              onClick={shuffleTopic}
              disabled={stage !== 'idle'}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors disabled:opacity-50"
            >
              🎲
            </button>
            <button
              onClick={() => setIsCustomTopic(!isCustomTopic)}
              disabled={stage !== 'idle'}
              className={`px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                isCustomTopic ? 'bg-red-100 text-red-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              ✏️
            </button>
          </div>

          {/* The JAM button */}
          <button
            onClick={handleJam}
            disabled={stage !== 'idle'}
            className="relative w-36 h-36 rounded-full bg-gradient-to-br from-red-500 to-red-700
                       text-white font-bold text-3xl shadow-lg shadow-red-500/50
                       hover:from-red-400 hover:to-red-600 hover:scale-105 hover:shadow-xl
                       active:scale-95 transition-all duration-200
                       disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                       border-4 border-red-800"
          >
            {stage === 'idle' ? 'JAM' : stage === 'done' ? '✓' : '...'}
          </button>

          {/* Progress indicator */}
          {stage !== 'idle' && stage !== 'error' && (
            <div className="text-center w-full">
              <div className="text-sm text-slate-600 mb-2">
                {stage === 'generating' && generatingLabel ? generatingLabel : stageConfig.label}
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {stage === 'error' && (
            <div className="text-center">
              <div className="text-red-500 text-sm mb-2">{errorMsg}</div>
              <button
                onClick={() => setStage('idle')}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Cost indicator */}
          <span className="text-xs text-slate-400">{MODEL_CONFIG[profile.contentModel].cost} per jam</span>

          {/* Current settings summary */}
          <div className="text-xs text-slate-400 text-center">
            {profile.contentMode === 'halal' ? 'Halal' : profile.contentMode === 'elsd' ? 'ELSD' : 'Standard'} mode
            • {profile.targetDuration} min duration
          </div>
        </div>

      {/* Settings Modal */}
      {showSettings && (
        <JamSettingsModal
          profile={profile}
          onSave={(newProfile) => {
            setProfile(newProfile);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};
