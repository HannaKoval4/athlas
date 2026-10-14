import type { Locale, ThemePreference } from '@atlas/shared';
import { createContext, useContext } from 'react';

export interface Preferences {
  theme: ThemePreference;
  locale: Locale;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
}

export const PreferencesContext = createContext<Preferences | null>(null);

export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return value;
}
