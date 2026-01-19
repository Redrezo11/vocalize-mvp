import { useState, useCallback, useRef } from 'react';
import { ElevenLabsVoice, SpeakerVoiceMapping } from '../types';

// Concatenate multiple audio blobs into one
const concatenateAudioBlobs = async (blobs: Blob[]): Promise<Blob> => {
  if (blobs.length === 0) throw new Error('No audio blobs to concatenate');
  if (blobs.length === 1) return blobs[0];

  // Create an AudioContext to decode and merge audio
  const audioContext = new AudioContext();
  const audioBuffers: AudioBuffer[] = [];

  // Decode all blobs to AudioBuffers
  for (const blob of blobs) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioBuffers.push(audioBuffer);
  }

  // Calculate total length
  const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
  const numberOfChannels = audioBuffers[0].numberOfChannels;
  const sampleRate = audioBuffers[0].sampleRate;

  // Create a new buffer to hold all audio
  const outputBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

  // Copy all audio data into the output buffer
  let offset = 0;
  for (const buffer of audioBuffers) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const outputData = outputBuffer.getChannelData(channel);
      const inputData = buffer.getChannelData(channel);
      outputData.set(inputData, offset);
    }
    offset += buffer.length;
  }

  // Convert AudioBuffer to WAV Blob
  const wavBlob = audioBufferToWav(outputBuffer);
  await audioContext.close();

  return wavBlob;
};

// Convert AudioBuffer to WAV format
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

export const useElevenLabsTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchVoices = useCallback(async (apiKey: string) => {
    if (!apiKey) return;
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey }
      });
      const data = await response.json();
      setVoices(data.voices || []);
    } catch (error) {
      console.error('Failed to fetch ElevenLabs voices', error);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Generate audio blob for a single segment (no playback)
  const generateSegmentBlob = useCallback(async (text: string, voiceId: string, apiKey: string): Promise<Blob> => {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.detail?.message || 'ElevenLabs API request failed');
    }

    return await response.blob();
  }, []);

  // Play a blob and wait for it to finish
  const playBlob = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        reject(new Error('Audio playback failed'));
      };
      audio.play().catch(reject);
    });
  }, []);

  // Generate audio without playing - returns the combined blob
  const generateAudio = useCallback(async (
    text: string,
    apiKey: string,
    segments?: { speaker: string; text: string }[],
    speakerMapping?: SpeakerVoiceMapping,
    defaultVoiceId?: string
  ): Promise<Blob | null> => {
    if (!apiKey || !text) return null;

    try {
      setIsLoading(true);
      const blobs: Blob[] = [];

      if (segments && segments.length > 0 && speakerMapping) {
        for (const segment of segments) {
          const voiceId = speakerMapping[segment.speaker] || defaultVoiceId;
          if (!voiceId) {
            console.warn(`No voice assigned for speaker: ${segment.speaker}`);
            continue;
          }
          const blob = await generateSegmentBlob(segment.text, voiceId, apiKey);
          blobs.push(blob);
        }
      } else if (defaultVoiceId) {
        const blob = await generateSegmentBlob(text, defaultVoiceId, apiKey);
        blobs.push(blob);
      } else {
        alert('Please assign voices to speakers before generating.');
        return null;
      }

      if (blobs.length === 0) return null;

      // Concatenate all blobs into one
      const combinedBlob = await concatenateAudioBlobs(blobs);
      return combinedBlob;
    } catch (error) {
      console.error('ElevenLabs TTS Error:', error);
      alert(`Failed to generate ElevenLabs speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [generateSegmentBlob]);

  // Speak (generate + play)
  const speak = useCallback(async (
    text: string,
    apiKey: string,
    segments?: { speaker: string; text: string }[],
    speakerMapping?: SpeakerVoiceMapping,
    defaultVoiceId?: string
  ): Promise<Blob | null> => {
    stop();

    const blob = await generateAudio(text, apiKey, segments, speakerMapping, defaultVoiceId);
    if (blob) {
      await playBlob(blob);
    }
    return blob;
  }, [stop, generateAudio, playBlob]);

  return {
    speak,
    stop,
    isPlaying,
    isLoading,
    voices,
    fetchVoices,
    generateAudio,  // New: generate without playing
  };
};
