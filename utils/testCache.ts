import { ListeningTest } from '../types';

// Shared module-level cache for full test data.
// Survives component unmount/remount. Both App.tsx and ClassroomMode.tsx
// read/write this cache so newly created tests are instantly available
// without a redundant server fetch.
export const fullTestCache = new Map<string, ListeningTest>();
