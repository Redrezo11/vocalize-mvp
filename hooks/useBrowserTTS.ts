import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserVoiceConfig, SpeakerSegment, SpeakerVoiceMapping } from '../types';

export const useBrowserTTS = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const synth = useRef<SpeechSynthesis>(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const populateVoices = useCallback(() => {
    const availableVoices = synth.current.getVoices();
    setVoices(availableVoices);
  }, []);

  useEffect(() => {
    populateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populateVoices;
    }
  }, [populateVoices]);

  const cancel = useCallback(() => {
    synth.current.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    if (synth.current.speaking && !synth.current.paused) {
      synth.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (synth.current.paused) {
      synth.current.resume();
      setIsPaused(false);
      setIsPlaying(true);
    }
  }, []);

  // Handle single text or dialogue segments
  const speak = useCallback((
    text: string,
    config: BrowserVoiceConfig,
    segments?: SpeakerSegment[],
    mapping?: SpeakerVoiceMapping
  ) => {
    cancel();

    if (!text && (!segments || segments.length === 0)) return;

    // Helper to create and queue an utterance
    const queueUtterance = (txt: string, voiceName?: string) => {
      const utterance = new SpeechSynthesisUtterance(txt);

      // Determine voice
      let selectedVoice = config.voice;
      if (voiceName) {
        const mappedVoice = voices.find(v => v.name === voiceName);
        if (mappedVoice) selectedVoice = mappedVoice;
      }

      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = config.rate;
      utterance.pitch = config.pitch;
      utterance.volume = config.volume;

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        // If there are no more utterances in the queue, we are done
        if (!synth.current.pending) {
          setIsPlaying(false);
          setIsPaused(false);
        }
      };

      utterance.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') return;
        console.error("Speech synthesis error", event.error);
        setIsPlaying(false);
        setIsPaused(false);
      };

      utteranceRef.current = utterance; // Keep ref to last one
      synth.current.speak(utterance);
    };

    if (segments && mapping) {
      // Multi-speaker mode
      segments.forEach(seg => {
        const assignedVoiceName = mapping[seg.speaker];
        queueUtterance(seg.text, assignedVoiceName);
      });
    } else {
      // Single speaker mode
      queueUtterance(text);
    }

  }, [cancel, voices]);

  // Note: Browser TTS (Web Speech API) cannot capture audio output.
  // The speech synthesis plays directly through system audio with no programmatic access.
  // For saving audio, use ElevenLabs or Gemini TTS engines instead.

  return {
    voices,
    speak,
    cancel,
    pause,
    resume,
    isPlaying,
    isPaused
  };
};
