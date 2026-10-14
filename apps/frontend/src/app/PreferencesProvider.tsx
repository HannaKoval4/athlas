import { ThemePreference, type UserProfile } from '@atlas/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { currentUserKey, useCurrentUser, useUpdateProfile } from '../auth/api.ts';
import i18n from '../i18n/index.ts';
import { type Preferences, PreferencesContext } from './preferences-context.ts';
import {
  applyTheme,
  languageOf,
  onSystemThemeChange,
  rememberLocale,
  storedLocale,
  storedTheme,
} from './preferences.ts';

/**
 * Theme and interface language (F-17). For a logged-in user they come from the profile and a
 * change is saved to it; a guest's choice lives in localStorage only. Both apply at once: the
 * "dark" class on <html> and i18n.changeLanguage re-render the page without a reload.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const update = useUpdateProfile();
  const [local, setLocal] = useState(() => ({ theme: storedTheme(), locale: storedLocale() }));
  // After logout the page keeps the user's last choice instead of the pre-login one.
  const [seenUser, setSeenUser] = useState(user);
  if (user && user !== seenUser) {
    setSeenUser(user);
    setLocal({ theme: user.theme, locale: user.locale });
  }

  const theme = user?.theme ?? local.theme;
  const locale = user?.locale ?? local.locale;

  useEffect(() => {
    applyTheme(theme);
    if (theme !== ThemePreference.SYSTEM) return;
    // "As in the system" follows the OS switch live, not only on load.
    return onSystemThemeChange(() => applyTheme(ThemePreference.SYSTEM));
  }, [theme]);

  useEffect(() => {
    rememberLocale(locale);
    const language = languageOf(locale);
    document.documentElement.lang = language;
    if (i18n.resolvedLanguage !== language) void i18n.changeLanguage(language);
  }, [locale]);

  function save(change: Partial<Pick<UserProfile, 'theme' | 'locale'>>) {
    setLocal((current) => ({ ...current, ...change }));
    if (!user) return;
    // Optimistic: apply at once, the PATCH answer confirms; on failure re-read the profile.
    queryClient.setQueryData<UserProfile>(currentUserKey, { ...user, ...change });
    update.mutate(change, {
      onError: () => void queryClient.invalidateQueries({ queryKey: currentUserKey }),
    });
  }

  const value: Preferences = {
    theme,
    locale,
    setTheme: (next) => save({ theme: next }),
    setLocale: (next) => save({ locale: next }),
  };
  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}
