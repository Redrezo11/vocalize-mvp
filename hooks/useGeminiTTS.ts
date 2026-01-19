import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { GeminiVoiceConfig, SpeakerVoiceMapping } from '../types';

export const useGeminiTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const speak = useCallback(async (
    text: string, 
    config: GeminiVoiceConfig,
    speakerMapping?: SpeakerVoiceMapping
  ) => {
    if (!apiKey) {
      console.error("No API Key available for Gemini");
      return;
    }

    try {
      setIsLoading(true);
      stop(); 

      const ai = new GoogleGenAI({ apiKey });
      
      // Default to single voice config
      let speechConfig: any = {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: config.voiceName },
        },
      };

      const speakerEntries = speakerMapping ? Object.entries(speakerMapping) : [];

      // API LIMITATION: The Gemini TTS Preview model strictly requires exactly 2 enabled_voices 
      // in the multi_speaker_voice_config.
      // If we have >= 2 speakers, we configure the first 2.
      // If we have 1 speaker, we use single voice config.
      if (speakerEntries.length >= 2) {
        const limitedEntries = speakerEntries.slice(0, 2);
        
        const speakerConfigs = limitedEntries.map(([speaker, voiceName]) => ({
          speaker: speaker,
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        }));

        speechConfig = {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: speakerConfigs
          }
        };
      } else if (speakerEntries.length === 1) {
        // Use the specific mapped voice for the single detected speaker
        speechConfig = {
          voiceConfig: {
             prebuiltVoiceConfig: { voiceName: speakerEntries[0][1] }
          }
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: {
          parts: [{ text }],
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: speechConfig,
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!base64Audio) {
        throw new Error("No audio data received from Gemini");
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 24000 
        });
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const dataInt16 = new Int16Array(bytes.buffer);
      const numChannels = 1;
      const sampleRate = 24000;
      
      const audioBuffer = audioContextRef.current.createBuffer(
        numChannels,
        dataInt16.length,
        sampleRate
      );

      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsPlaying(false);
      };

      sourceNodeRef.current = source;
      source.start();
      setIsPlaying(true);

    } catch (error) {
      console.error("Gemini TTS Error:", error);
      alert("Failed to generate AI speech. Check console for details.");
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, stop]);

  return {
    speak,
    stop,
    isPlaying,
    isLoading,
    hasKey: !!apiKey
  };
};