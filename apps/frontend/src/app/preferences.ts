import { Locale, ThemePreference } from '@atlas/shared';

export type ResolvedTheme = 'light' | 'dark';

/**
 * The last applied preferences are mirrored in localStorage so that the next page load starts
 * with the right theme and language before /auth/me answers (no flash of the light theme), and
 * so that guests on the login page keep their choice. The profile in the DB stays the source of
 * truth for a logged-in user. index.html reads the theme key too, keep the names in sync.
 */
export const THEME_STORAGE_KEY = 'atlas.theme';
export const LOCALE_STORAGE_KEY = 'atlas.locale';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === ThemePreference.SYSTEM) return systemDark ? 'dark' : 'light';
  return preference === ThemePreference.DARK ? 'dark' : 'light';
}

/** i18next language code of a profile locale. */
export function languageOf(locale: Locale): 'ru' | 'en' {
  return locale === Locale.EN ? 'en' : 'ru';
}

function isOneOf<T extends string>(values: Record<string, T>, value: string | null): value is T {
  return value !== null && (Object.values(values) as string[]).includes(value);
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage disabled: fall back to the defaults
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage disabled: the choice still applies for this visit
  }
}

export function storedTheme(): ThemePreference {
  const value = readStorage(THEME_STORAGE_KEY);
  return isOneOf(ThemePreference, value) ? value : ThemePreference.SYSTEM;
}

export function storedLocale(): Locale {
  const value = readStorage(LOCALE_STORAGE_KEY);
  return isOneOf(Locale, value) ? value : Locale.RU;
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

/** Calls back when the OS theme changes; returns the unsubscribe function. */
export function onSystemThemeChange(callback: () => void): () => void {
  const query = window.matchMedia(SYSTEM_DARK_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

/** Puts the theme on <html>: the "dark" class drives Tailwind, color-scheme drives native controls. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  writeStorage(THEME_STORAGE_KEY, preference);
  return resolved;
}

export function rememberLocale(locale: Locale): void {
  writeStorage(LOCALE_STORAGE_KEY, locale);
}
