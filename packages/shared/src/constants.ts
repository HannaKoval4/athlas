/** Global prefix of every backend route: http://host/api/... */
export const API_PREFIX = 'api';

/** Path (under the global prefix) where Swagger UI is served. */
export const API_DOCS_PATH = 'docs';

export const SUPPORTED_LOCALES = ['ru', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
