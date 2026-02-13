import { ListeningTest } from '../types';

const STORAGE_KEY = 'df_fullTestCache';

// Restore cache from sessionStorage on module load
function restoreCache(): Map<string, ListeningTest> {
  const cache = new Map<string, ListeningTest>();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const entries: [string, ListeningTest][] = JSON.parse(raw);
      for (const [key, value] of entries) cache.set(key, value);
    }
  } catch {}
  return cache;
}

// Persist entire cache to sessionStorage
function persistCache(cache: Map<string, ListeningTest>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...cache.entries()]));
  } catch {} // Quota exceeded — in-memory cache still works
}

const cache = restoreCache();

// Shared cache for full test data. Backed by sessionStorage so it
// survives page reloads and mobile browser tab kills.
export const fullTestCache = {
  get: (key: string) => cache.get(key),
  set: (key: string, value: ListeningTest) => { cache.set(key, value); persistCache(cache); return fullTestCache; },
  has: (key: string) => cache.has(key),
};
