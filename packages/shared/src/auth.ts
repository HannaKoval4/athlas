import type { Locale, Role, ThemePreference } from './enums.js';

/** BR-02: minimum password length. */
export const PASSWORD_MIN_LENGTH = 8;
/** Upper bound keeps argon2 hashing cost predictable (no multi-megabyte "passwords"). */
export const PASSWORD_MAX_LENGTH = 128;
/** BR-02: at least one letter (any alphabet, e.g. Cyrillic) and at least one digit. */
export const PASSWORD_PATTERN = /^(?=.*\p{L})(?=.*\d).+$/su;

export const NAME_MAX_LENGTH = 100;
/** Practical maximum length of an e-mail address (RFC 5321 path limit). */
export const EMAIL_MAX_LENGTH = 254;

/** BR-02: the password policy, applied identically on the client and the server. */
export function isValidPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    PASSWORD_PATTERN.test(password)
  );
}

/** BR-01: e-mails are unique case-insensitively, so they are always stored trimmed and lower-case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Public view of a user returned by /auth/* and /users/me (never contains the password hash). */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  theme: ThemePreference;
  locale: Locale;
  createdAt: string;
  /** ISO date of the consent to personal data processing; null for seeded accounts */
  consentAt: string | null;
}
