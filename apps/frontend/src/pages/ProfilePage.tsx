import { Locale, ThemePreference, type UserProfile } from '@atlas/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isApiError } from '../api/client.ts';
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
        <PasswordChange />
        <section aria-labelledby="notes-export" className="flex flex-col gap-2">
          <h2 id="notes-export" className="text-xl font-semibold">
            {t('notes.exportTitle')}
          </h2>
          <p className="text-sm text-stone-600">{t('notes.exportHint')}</p>
          <ExportNotes />
        </section>
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
    defaultValues: { name: user.name, email: user.email, theme: user.theme, locale: user.locale },
  });
  const emailTaken = isApiError(update.error, 409);

  return (
    <section aria-labelledby="profile-details" className="flex flex-col gap-4">
      <h2 id="profile-details" className="text-xl font-semibold">
        {t('profile.detailsTitle')}
      </h2>
      <p className="text-sm text-stone-600" data-testid="profile-consent">
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
        <Field label={t('profile.theme')}>
          {({ id }) => (
            <Select id={id} data-testid="profile-theme" {...register('theme')}>
              {Object.values(ThemePreference).map((theme) => (
                <option key={theme} value={theme}>
                  {t(`profile.themes.${theme}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('profile.locale')}>
          {({ id }) => (
            <Select id={id} data-testid="profile-locale" {...register('locale')}>
              {Object.values(Locale).map((locale) => (
                <option key={locale} value={locale}>
                  {t(`profile.locales.${locale}`)}
                </option>
              ))}
            </Select>
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
