import { type AppLocale, formatPeriod, formatYear } from '@atlas/shared';
import { useTranslation } from 'react-i18next';

/** The interface language as a locale of the shared formatters ("ru" or "en"). */
export function appLocaleOf(language: string | undefined): AppLocale {
  return language === 'en' ? 'en' : 'ru';
}

/**
 * Year formatters bound to the current interface language (DM-01): "527 г. до н. э." in Russian,
 * "527 BCE" in English. Components re-render on a language change, so years switch with it.
 */
export function useYearFormat() {
  const { i18n } = useTranslation();
  const locale = appLocaleOf(i18n.resolvedLanguage);
  return {
    formatYear: (year: number) => formatYear(year, locale),
    formatPeriod: (startYear: number, endYear: number) => formatPeriod(startYear, endYear, locale),
  };
}
