import { Locale, ThemePreference, type UserProfile } from '@atlas/shared';
import { useId } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isApiError } from '../api/client.ts';
import { usePreferences } from '../app/preferences-context.ts';
import { useChangePassword, useCurrentUser, useUpdateProfile } from '../auth/api.ts';
import {
  type PasswordForm,
  type ProfileForm,
  passwordSchema,
  profileSchema,
} from '../auth/schemas.ts';
import { PageContainer } from '../components/AppLayout.tsx';
import {
  Field,
  FormError,
  FormSuccess,
  Select,
  SubmitButton,
  TextInput,
} from '../components/form.tsx';
import { ViewHistory } from '../discover/ViewHistory.tsx';
import { Achievements } from '../quizzes/Achievements.tsx';
import { ExportNotes } from '../notes/ExportNotes.tsx';

export function ProfilePage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  // RequireAuth renders this page only for a logged-in user.
  if (!user) return null;

  return (
    <PageContainer>
      <div className="flex max-w-xl flex-col gap-10">
        <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
        <ProfileDetails user={user} />
        <Appearance />
        <PasswordChange />
        <section aria-labelledby="notes-export" className="flex flex-col gap-2">
          <h2 id="notes-export" className="text-xl font-semibold">
            {t('notes.exportTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('notes.exportHint')}</p>
          <ExportNotes />
        </section>
        <Achievements />
        <ViewHistory />
      </div>
    </PageContainer>
  );
}

function ProfileDetails({ user }: { user: UserProfile }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, email: user.email },
  });
  const emailTaken = isApiError(update.error, 409);

  return (
    <section aria-labelledby="profile-details" className="flex flex-col gap-4">
      <h2 id="profile-details" className="text-xl font-semibold">
        {t('profile.detailsTitle')}
      </h2>
      <p className="text-sm text-muted-foreground" data-testid="profile-consent">
        {user.consentAt
          ? t('profile.consentGiven', {
              date: new Date(user.consentAt).toLocaleDateString(i18n.language),
            })
          : t('profile.consentMissing')}
      </p>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => update.mutate(values))}
      >
        <Field label={t('auth.name')} error={errors.name?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              data-testid="profile-name"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('name')}
            />
          )}
        </Field>
        <Field
          label={t('auth.email')}
          error={errors.email?.message ?? (emailTaken ? t('auth.errors.emailTaken') : undefined)}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="email"
              data-testid="profile-email"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('email')}
            />
          )}
        </Field>
        {update.isError && !emailTaken && <FormError>{t('auth.errors.generic')}</FormError>}
        {update.isSuccess && <FormSuccess testId="profile-saved">{t('profile.saved')}</FormSuccess>}
        <div>
          <SubmitButton disabled={update.isPending} data-testid="profile-save">
            {t('profile.save')}
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

/**
 * Theme and language apply as soon as they are picked and are saved to the profile at once:
 * there is nothing to confirm, and the header switches change the same values.
 */
function Appearance() {
  const { t } = useTranslation();
  const { theme, locale, setTheme, setLocale } = usePreferences();
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-xl font-semibold">
          {t('preferences.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('preferences.hint')}</p>
      </div>
      <Field label={t('profile.theme')}>
        {({ id }) => (
          <Select
            id={id}
            data-testid="profile-theme"
            value={theme}
            onChange={(event) => setTheme(event.target.value as ThemePreference)}
          >
            {Object.values(ThemePreference).map((value) => (
              <option key={value} value={value}>
                {t(`profile.themes.${value}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t('profile.locale')}>
        {({ id }) => (
          <Select
            id={id}
            data-testid="profile-locale"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            {Object.values(Locale).map((value) => (
              <option key={value} value={value} lang={value === Locale.EN ? 'en' : 'ru'}>
                {t(`profile.locales.${value}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </section>
  );
}

function PasswordChange() {
  const { t } = useTranslation();
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const wrongCurrent = isApiError(change.error, 400);

  return (
    <section aria-labelledby="password-change" className="flex flex-col gap-4">
      <h2 id="password-change" className="text-xl font-semibold">
        {t('profile.passwordTitle')}
      </h2>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => change.mutate(values, { onSuccess: () => reset() }))}
      >
        <Field
          label={t('profile.currentPassword')}
          error={
            errors.currentPassword?.message ??
            (wrongCurrent ? t('profile.errors.currentPasswordWrong') : undefined)
          }
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="current-password"
              data-testid="current-password"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('currentPassword')}
            />
          )}
        </Field>
        <Field
          label={t('profile.newPassword')}
          hint={t('auth.passwordHint')}
          error={errors.newPassword?.message}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="new-password"
              data-testid="new-password"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('newPassword')}
            />
          )}
        </Field>
        {change.isError && !wrongCurrent && <FormError>{t('auth.errors.generic')}</FormError>}
        {change.isSuccess && (
          <FormSuccess testId="password-changed">{t('profile.passwordChanged')}</FormSuccess>
        )}
        <div>
          <SubmitButton disabled={change.isPending} data-testid="password-submit">
            {t('profile.changePassword')}
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
