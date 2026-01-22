import { useState, useEffect, useCallback } from 'react';
import { SavedAudio, EngineType, SpeakerVoiceMapping } from '../types';

const API_BASE = 'http://localhost:3001/api';

// Convert MongoDB document to app model
interface MongoAudioEntry {
  _id: string;
  title: string;
  transcript: string;
  audio_url?: string | null;
  audio_data?: string | null; // Base64 encoded audio
  engine?: string;
  speaker_mapping?: SpeakerVoiceMapping;
  speakers?: string[];
  duration?: number;
  created_at: string;
  updated_at: string;
}

const docToSavedAudio = (doc: MongoAudioEntry): SavedAudio => ({
  id: doc._id,
  title: doc.title,
  transcript: doc.transcript,
  audioUrl: doc.audio_url || (doc.audio_data ? `data:audio/mpeg;base64,${doc.audio_data}` : null),
  engine: (doc.engine as EngineType) || EngineType.ELEVEN_LABS,
  speakerMapping: doc.speaker_mapping || {},
  speakers: doc.speakers || [],
  createdAt: doc.created_at,
  updatedAt: doc.updated_at,
});

export const useMongoStorage = () => {
  const [savedAudios, setSavedAudios] = useState<SavedAudio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read all
  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/audio-entries`);
      if (!response.ok) throw new Error('Failed to fetch entries');

      const data: MongoAudioEntry[] = await response.json();
      setSavedAudios(data.map(docToSavedAudio));
    } catch (err) {
      console.error('Failed to load audio entries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Read one
  const getById = useCallback(async (id: string): Promise<SavedAudio | null> => {
    try {
      const response = await fetch(`${API_BASE}/audio-entries/${id}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch entry');
      }

      const data: MongoAudioEntry = await response.json();
      return docToSavedAudio(data);
    } catch (err) {
      console.error('Failed to get audio entry:', err);
      return null;
    }
  }, []);

  // Helper: Convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Create
  const create = useCallback(async (
    audio: Omit<SavedAudio, 'id' | 'createdAt' | 'updatedAt' | 'audioUrl'>,
    audioBlob?: Blob
  ): Promise<SavedAudio | null> => {
    try {
      setError(null);

      let audioData: string | null = null;
      if (audioBlob) {
        audioData = await blobToBase64(audioBlob);
      }

      const response = await fetch(`${API_BASE}/audio-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: audio.title,
          transcript: audio.transcript,
          audio_data: audioData,
          engine: audio.engine,
          speaker_mapping: audio.speakerMapping,
          speakers: audio.speakers,
        }),
      });

      if (!response.ok) throw new Error('Failed to create entry');

      const data: MongoAudioEntry = await response.json();
      const newAudio = docToSavedAudio(data);
      setSavedAudios(prev => [newAudio, ...prev]);
      return newAudio;
    } catch (err) {
      console.error('Failed to create audio entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to create');
      return null;
    }
  }, []);

  // Update
  const update = useCallback(async (
    id: string,
    updates: Partial<Omit<SavedAudio, 'id' | 'createdAt' | 'updatedAt'>>,
    audioBlob?: Blob
  ): Promise<SavedAudio | null> => {
    try {
      setError(null);

      let audioData: string | undefined;
      if (audioBlob) {
        audioData = await blobToBase64(audioBlob);
      }

      const response = await fetch(`${API_BASE}/audio-entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updates.title,
          transcript: updates.transcript,
          audio_data: audioData,
          engine: updates.engine,
          speaker_mapping: updates.speakerMapping,
          speakers: updates.speakers,
        }),
      });

      if (!response.ok) throw new Error('Failed to update entry');

      const data: MongoAudioEntry = await response.json();
      const updatedAudio = docToSavedAudio(data);
      setSavedAudios(prev =>
        prev.map(a => (a.id === id ? updatedAudio : a))
      );
      return updatedAudio;
    } catch (err) {
      console.error('Failed to update audio entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to update');
      return null;
    }
  }, []);

  // Delete
  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const response = await fetch(`${API_BASE}/audio-entries/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete entry');

      setSavedAudios(prev => prev.filter(a => a.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete audio entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
      return false;
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    savedAudios,
    isLoading,
    error,
    loadAll,
    getById,
    create,
    update,
    remove,
  };
};
