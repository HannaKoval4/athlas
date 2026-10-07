import {
  EMAIL_MAX_LENGTH,
  Locale,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  ThemePreference,
} from '@atlas/shared';
import { z } from 'zod';
import type { ValidationKey } from '../i18n/index.ts';

// Messages are i18n keys (ValidationKey); FormField translates them. The rules come from
// @atlas/shared, so the client checks exactly what the server checks (BR-02).
const msg = (key: ValidationKey) => key;

const email = z
  .string()
  .trim()
  .min(1, msg('required'))
  .max(EMAIL_MAX_LENGTH, msg('emailInvalid'))
  .pipe(z.email(msg('emailInvalid')));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, msg('passwordTooShort'))
  .max(PASSWORD_MAX_LENGTH, msg('passwordTooLong'))
  .regex(PASSWORD_PATTERN, msg('passwordWeak'));

const existingPassword = z.string().min(1, msg('required'));

const name = z.string().trim().min(1, msg('required')).max(NAME_MAX_LENGTH, msg('nameTooLong'));

export const loginSchema = z.object({ email, password: existingPassword });
export const registerSchema = z.object({
  name,
  email,
  password: newPassword,
  // Personal data processing consent: the server rejects anything but true as well.
  consent: z.boolean().refine((value) => value, msg('consentRequired')),
});
export const profileSchema = z.object({
  name,
  email,
  theme: z.enum(Object.values(ThemePreference)),
  locale: z.enum(Object.values(Locale)),
});
export const passwordSchema = z.object({
  currentPassword: existingPassword,
  newPassword,
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type ProfileForm = z.infer<typeof profileSchema>;
export type PasswordForm = z.infer<typeof passwordSchema>;
