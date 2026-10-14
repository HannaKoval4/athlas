import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { languageOf, storedLocale } from '../app/preferences.ts';
import { en } from './locales/en.ts';
import { ru } from './locales/ru.ts';

export const defaultNS = 'translation';
export const resources = {
  ru: { translation: ru },
  en: { translation: en },
} as const;

/** Keys of user-facing validation messages; zod schemas store these keys, components translate them. */
export type ValidationKey = keyof typeof ru.validation;

// Start in the last used language (no flash of Russian for an English user); PreferencesProvider
// then switches to the profile's language once /auth/me answers.
void i18n.use(initReactI18next).init({
  resources,
  lng: languageOf(storedLocale()),
  fallbackLng: 'ru',
  defaultNS,
  interpolation: { escapeValue: false }, // React already escapes rendered strings
});

export default i18n;
