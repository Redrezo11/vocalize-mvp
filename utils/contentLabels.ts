import type { AppMode } from '../contexts/AppModeContext';

export interface ContentLabel {
  type: string;       // "monologue" | "dialogue" | "discussion" | "reading passage"
  theType: string;    // "the monologue" | "the dialogue" | "the discussion" | "the passage"
  verb: string;       // "listen" | "read"
  pastVerb: string;   // "listened to" | "read"
  imperative: string; // "Listen" | "Read"
}

const READING_LABELS: ContentLabel = {
  type: 'reading passage',
  theType: 'the passage',
  verb: 'read',
  pastVerb: 'read',
  imperative: 'Read',
};

const MONOLOGUE_LABELS: ContentLabel = {
  type: 'monologue',
  theType: 'the monologue',
  verb: 'listen',
  pastVerb: 'listened to',
  imperative: 'Listen',
};

const DIALOGUE_LABELS: ContentLabel = {
  type: 'dialogue',
  theType: 'the dialogue',
  verb: 'listen',
  pastVerb: 'listened to',
  imperative: 'Listen',
};

const DISCUSSION_LABELS: ContentLabel = {
  type: 'discussion',
  theType: 'the discussion',
  verb: 'listen',
  pastVerb: 'listened to',
  imperative: 'Listen',
};

export function getContentLabels(speakerCount: number | null | undefined, appMode: AppMode): ContentLabel {
  if (appMode === 'reading') return READING_LABELS;
  if (speakerCount === 1) return MONOLOGUE_LABELS;
  if (speakerCount != null && speakerCount >= 3) return DISCUSSION_LABELS;
  return DIALOGUE_LABELS; // default for 2, null, undefined
}
