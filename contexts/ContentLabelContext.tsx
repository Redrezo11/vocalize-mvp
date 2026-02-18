import React, { createContext, useContext } from 'react';
import type { ContentLabel } from '../utils/contentLabels';

// Default to dialogue labels (most common case)
const defaultLabels: ContentLabel = {
  type: 'dialogue',
  theType: 'the dialogue',
  verb: 'listen',
  pastVerb: 'listened to',
  imperative: 'Listen',
};

const ContentLabelContext = createContext<ContentLabel>(defaultLabels);

export const ContentLabelProvider: React.FC<{ label: ContentLabel; children: React.ReactNode }> = ({ label, children }) => (
  <ContentLabelContext.Provider value={label}>
    {children}
  </ContentLabelContext.Provider>
);

export const useContentLabel = (): ContentLabel => useContext(ContentLabelContext);
