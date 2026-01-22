import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserVoiceConfig, SpeakerSegment, SpeakerVoiceMapping } from '../types';

export const useBrowserTTS = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  // Generate audio blob using Web Audio API + MediaRecorder
  // This captures the speech synthesis output by using an AudioContext
  const generateAudio = useCallback(async (
    text: string,
    config: BrowserVoiceConfig,
    segments?: SpeakerSegment[],
    mapping?: SpeakerVoiceMapping
  ): Promise<Blob | null> => {
    if (!text && (!segments || segments.length === 0)) return null;

    setIsLoading(true);
    cancel();

    return new Promise((resolve) => {
      // Create audio context and destination for recording
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Create MediaRecorder to capture the audio stream
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsLoading(false);
        setIsPlaying(false);

        if (audioChunks.length === 0) {
          resolve(null);
          return;
        }

        // Create webm blob
        const webmBlob = new Blob(audioChunks, { type: 'audio/webm' });

        // Convert to WAV for better compatibility
        try {
          const wavBlob = await convertWebmToWav(webmBlob, audioContext);
          audioContext.close();
          resolve(wavBlob);
        } catch (error) {
          console.error('Failed to convert audio:', error);
          audioContext.close();
          resolve(webmBlob); // Fallback to webm
        }
      };

      // Track utterances completion
      let totalUtterances = 0;
      let completedUtterances = 0;

      const queueUtteranceForRecording = (txt: string, voiceName?: string) => {
        totalUtterances++;
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
        };

        utterance.onend = () => {
          completedUtterances++;
          if (completedUtterances >= totalUtterances) {
            // All utterances done, stop recording with a small delay
            setTimeout(() => {
              mediaRecorder.stop();
            }, 300);
          }
        };

        utterance.onerror = (event) => {
          if (event.error === 'canceled' || event.error === 'interrupted') {
            completedUtterances++;
            if (completedUtterances >= totalUtterances) {
              mediaRecorder.stop();
            }
            return;
          }
          console.error("Speech synthesis error during recording", event.error);
          completedUtterances++;
          if (completedUtterances >= totalUtterances) {
            mediaRecorder.stop();
          }
        };

        synth.current.speak(utterance);
      };

      // Start recording
      mediaRecorder.start();

      // Queue all utterances
      if (segments && mapping) {
        segments.forEach(seg => {
          const assignedVoiceName = mapping[seg.speaker];
          queueUtteranceForRecording(seg.text, assignedVoiceName);
        });
      } else {
        queueUtteranceForRecording(text);
      }

      // Timeout safety - stop after 5 minutes max
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.warn('Recording timeout reached');
          synth.current.cancel();
          mediaRecorder.stop();
        }
      }, 5 * 60 * 1000);
    });
  }, [cancel, voices]);

  return {
    voices,
    speak,
    cancel,
    pause,
    resume,
    isPlaying,
    isPaused,
    isLoading,
    generateAudio
  };
};

// Helper function to convert WebM to WAV for better compatibility
async function convertWebmToWav(webmBlob: Blob, audioContext: AudioContext): Promise<Blob> {
  const arrayBuffer = await webmBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Create WAV file
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  // Interleave channels
  const interleaved = new Float32Array(length * numberOfChannels);
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      interleaved[i * numberOfChannels + channel] = channelData[i];
    }
  }

  // Convert to 16-bit PCM
  const pcmData = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }

  // Create WAV header
  const wavHeader = createWavHeader(pcmData.length * 2, numberOfChannels, sampleRate);

  // Combine header and data
  const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
  return wavBlob;
}

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
