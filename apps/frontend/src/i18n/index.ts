import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en.ts';
import { ru } from './locales/ru.ts';

export const defaultNS = 'translation';
export const resources = {
  ru: { translation: ru },
  en: { translation: en },
} as const;

/** Keys of user-facing validation messages; zod schemas store these keys, components translate them. */
export type ValidationKey = keyof typeof ru.validation;

// Language switching and persistence in the profile are wired up in module 11 (themes and i18n).
void i18n.use(initReactI18next).init({
  resources,
  lng: 'ru',
  fallbackLng: 'ru',
  defaultNS,
  interpolation: { escapeValue: false }, // React already escapes rendered strings
});

export default i18n;
