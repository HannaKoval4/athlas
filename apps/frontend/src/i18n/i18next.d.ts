import 'i18next';
import type { ru } from './locales/ru.ts';

// Type-checked translation keys: t('auth.typo') is a compile error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ru };
  }
}
