import React, { createContext, useContext } from 'react';

export type AppMode = 'listening' | 'reading';

const AppModeContext = createContext<AppMode>('listening');

export const AppModeProvider: React.FC<{ mode: AppMode; children: React.ReactNode }> = ({ mode, children }) => (
  <AppModeContext.Provider value={mode}>
    {children}
  </AppModeContext.Provider>
);

export const useAppMode = (): AppMode => useContext(AppModeContext);
