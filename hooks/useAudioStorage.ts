import { useState, useEffect, useCallback } from 'react';
import { SavedAudio } from '../types';

const DB_NAME = 'vocalize-db';
const DB_VERSION = 1;
const STORE_NAME = 'saved-audio';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };
  });
};

export const useAudioStorage = () => {
  const [savedAudios, setSavedAudios] = useState<SavedAudio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Read all
  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true);
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as SavedAudio[];
        // Sort by updatedAt descending (newest first)
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        setSavedAudios(results);
        setIsLoading(false);
      };

      request.onerror = () => {
        console.error('Failed to load saved audios', request.error);
        setIsLoading(false);
      };
    } catch (error) {
      console.error('Failed to open database', error);
      setIsLoading(false);
    }
  }, []);

  // Read one
  const getById = useCallback(async (id: string): Promise<SavedAudio | null> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get audio by id', error);
      return null;
    }
  }, []);

  // Create
  const create = useCallback(async (audio: Omit<SavedAudio, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedAudio> => {
    const now = Date.now();
    const newAudio: SavedAudio = {
      ...audio,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.add(newAudio);
        request.onsuccess = () => {
          setSavedAudios(prev => [newAudio, ...prev]);
          resolve(newAudio);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to create audio', error);
      throw error;
    }
  }, []);

  // Update
  const update = useCallback(async (id: string, updates: Partial<Omit<SavedAudio, 'id' | 'createdAt'>>): Promise<SavedAudio | null> => {
    try {
      const existing = await getById(id);
      if (!existing) return null;

      const updatedAudio: SavedAudio = {
        ...existing,
        ...updates,
        updatedAt: Date.now(),
      };

      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.put(updatedAudio);
        request.onsuccess = () => {
          setSavedAudios(prev =>
            prev.map(a => (a.id === id ? updatedAudio : a)).sort((a, b) => b.updatedAt - a.updatedAt)
          );
          resolve(updatedAudio);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to update audio', error);
      return null;
    }
  }, [getById]);

  // Delete
  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => {
          setSavedAudios(prev => prev.filter(a => a.id !== id));
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete audio', error);
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
    loadAll,
    getById,
    create,
    update,
    remove,
  };
};
