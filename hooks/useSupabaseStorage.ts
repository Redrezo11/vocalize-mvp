import { useState, useEffect, useCallback } from 'react';
import { supabase, AUDIO_BUCKET } from '../lib/supabase';
import { SavedAudio, AudioEntryRow, EngineType, SpeakerVoiceMapping } from '../types';

// Convert database row to app model
const rowToSavedAudio = (row: AudioEntryRow): SavedAudio => ({
  id: row.id,
  title: row.title,
  transcript: row.transcript,
  audioUrl: row.audio_url,
  engine: row.engine as EngineType,
  speakerMapping: row.speaker_mapping || {},
  speakers: row.speakers || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const useSupabaseStorage = () => {
  const [savedAudios, setSavedAudios] = useState<SavedAudio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read all
  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('audio_entries')
        .select('*')
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;

      setSavedAudios((data || []).map(rowToSavedAudio));
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
      const { data, error: fetchError } = await supabase
        .from('audio_entries')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      return data ? rowToSavedAudio(data) : null;
    } catch (err) {
      console.error('Failed to get audio entry:', err);
      return null;
    }
  }, []);

  // Create
  const create = useCallback(async (
    audio: Omit<SavedAudio, 'id' | 'createdAt' | 'updatedAt' | 'audioUrl'>,
    audioBlob?: Blob
  ): Promise<SavedAudio | null> => {
    try {
      setError(null);

      // First, insert the database record
      const { data: insertedRow, error: insertError } = await supabase
        .from('audio_entries')
        .insert({
          title: audio.title,
          transcript: audio.transcript,
          engine: audio.engine,
          speaker_mapping: audio.speakerMapping,
          speakers: audio.speakers,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!insertedRow) throw new Error('No data returned from insert');

      let audioUrl: string | null = null;

      // If we have an audio blob, upload it to storage
      if (audioBlob) {
        const ext = audioBlob.type === 'audio/wav' ? 'wav' : 'mp3';
        const fileName = `${insertedRow.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(fileName, audioBlob, {
            contentType: audioBlob.type || 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error('Failed to upload audio:', uploadError);
        } else {
          // Get the public URL
          const { data: urlData } = supabase.storage
            .from(AUDIO_BUCKET)
            .getPublicUrl(fileName);
          audioUrl = urlData.publicUrl;

          // Update the record with the audio URL
          await supabase
            .from('audio_entries')
            .update({ audio_url: audioUrl })
            .eq('id', insertedRow.id);
        }
      }

      const newAudio = rowToSavedAudio({ ...insertedRow, audio_url: audioUrl });
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

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.transcript !== undefined) updateData.transcript = updates.transcript;
      if (updates.engine !== undefined) updateData.engine = updates.engine;
      if (updates.speakerMapping !== undefined) updateData.speaker_mapping = updates.speakerMapping;
      if (updates.speakers !== undefined) updateData.speakers = updates.speakers;

      // Upload new audio if provided
      if (audioBlob) {
        const ext = audioBlob.type === 'audio/wav' ? 'wav' : 'mp3';
        const fileName = `${id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(fileName, audioBlob, {
            contentType: audioBlob.type || 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error('Failed to upload audio:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from(AUDIO_BUCKET)
            .getPublicUrl(fileName);
          updateData.audio_url = urlData.publicUrl;
        }
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from('audio_entries')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (!updatedRow) throw new Error('No data returned from update');

      const updatedAudio = rowToSavedAudio(updatedRow);
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

      // Delete the audio file from storage
      const fileName = `${id}.mp3`;
      await supabase.storage
        .from(AUDIO_BUCKET)
        .remove([fileName]);

      // Delete the database record
      const { error: deleteError } = await supabase
        .from('audio_entries')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

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
