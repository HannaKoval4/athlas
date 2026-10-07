import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { isApiError } from '../api/client.ts';
import { useLogin, useRegister } from '../auth/api.ts';
import type { RedirectState } from '../auth/route-guards.tsx';
import { type LoginForm, type RegisterForm, loginSchema, registerSchema } from '../auth/schemas.ts';
import { Field, FormError, SubmitButton, TextInput } from '../components/form.tsx';

/** Server errors are mapped by status code; the UI never shows raw English API messages. */
function authErrorMessage(error: unknown, t: TFunction): string | undefined {
  if (!error) return undefined;
  if (isApiError(error, 401)) return t('auth.errors.invalidCredentials');
  if (isApiError(error, 409)) return t('auth.errors.emailTaken');
  if (isApiError(error, 429)) return t('auth.errors.tooManyAttempts');
  return t('auth.errors.generic');
}

function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 px-4 text-stone-900">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="mb-1 text-sm text-stone-600">{t('app.title')}</p>
        <h1 className="mb-6 text-2xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  return (
    <AuthCard title={t('auth.loginTitle')}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => login.mutate(values))}
      >
        <FormError testId="auth-error">{authErrorMessage(login.error, t)}</FormError>
        <Field label={t('auth.email')} error={errors.email?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="email"
              autoComplete="email"
              data-testid="email-input"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('email')}
            />
          )}
        </Field>
        <Field label={t('auth.password')} error={errors.password?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="current-password"
              data-testid="password-input"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('password')}
            />
          )}
        </Field>
        <SubmitButton disabled={login.isPending} data-testid="login-submit">
          {t('auth.submitLogin')}
        </SubmitButton>
      </form>
      <p className="mt-4 text-sm">
        {t('auth.noAccount')}{' '}
        <Link
          to="/register"
          state={location.state as RedirectState | null}
          className="text-amber-800 underline"
        >
          {t('auth.toRegister')}
        </Link>
      </p>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const signUp = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  return (
    <AuthCard title={t('auth.registerTitle')}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => signUp.mutate(values))}
      >
        <FormError testId="auth-error">{authErrorMessage(signUp.error, t)}</FormError>
        <Field label={t('auth.name')} error={errors.name?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              autoComplete="name"
              data-testid="name-input"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('name')}
            />
          )}
        </Field>
        <Field label={t('auth.email')} error={errors.email?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="email"
              autoComplete="email"
              data-testid="email-input"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('email')}
            />
          )}
        </Field>
        <Field
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          error={errors.password?.message}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="new-password"
              data-testid="password-input"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('password')}
            />
          )}
        </Field>
        <SubmitButton disabled={signUp.isPending} data-testid="register-submit">
          {t('auth.submitRegister')}
        </SubmitButton>
      </form>
      <p className="mt-4 text-sm">
        {t('auth.haveAccount')}{' '}
        <Link
          to="/login"
          state={location.state as RedirectState | null}
          className="text-amber-800 underline"
        >
          {t('auth.toLogin')}
        </Link>
      </p>
    </AuthCard>
  );
}
