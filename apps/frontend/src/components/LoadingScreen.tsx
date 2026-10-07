import { useTranslation } from 'react-i18next';

/** Shown only while a real request is pending (no artificial delay). */
export function LoadingScreen({
  label,
  fill = 'screen',
}: {
  label?: string;
  fill?: 'screen' | 'parent';
}) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid place-items-center text-stone-600 ${fill === 'screen' ? 'min-h-screen' : 'h-full'}`}
    >
      {label ?? t('app.loading')}
    </div>
  );
}
